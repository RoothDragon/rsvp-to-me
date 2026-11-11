// Root cause (October 2026): contact-change token consumption was separate from
// account/RSVP writes, permitting replay and burning tokens on failed updates.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockFindUniqueMagicToken,
  mockUpdateManyMagicToken,
  mockFindUniqueUser,
  mockFindFirstUser,
  mockUpdateUser,
  mockUpdateManyRsvps,
  mockLinkRsvpsToUser,
  mockSealSession,
  mockCreateSession,
  mockTransaction,
} = vi.hoisted(() => ({
  mockFindUniqueMagicToken: vi.fn(),
  mockUpdateManyMagicToken: vi.fn(),
  mockFindUniqueUser: vi.fn(),
  mockFindFirstUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockUpdateManyRsvps: vi.fn(),
  mockLinkRsvpsToUser: vi.fn(),
  mockSealSession: vi.fn(),
  mockCreateSession: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mockTransaction,
    magicToken: {
      findUnique: mockFindUniqueMagicToken,
    },
    user: {
      findUnique: mockFindUniqueUser,
      findFirst: mockFindFirstUser,
    },
    session: {
      create: mockCreateSession,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  sealSession: mockSealSession,
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 2592000,
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: vi.fn().mockReturnValue(false),
  redisSet: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  linkRsvpsToUser: mockLinkRsvpsToUser,
}));

import { GET } from "@/app/auth/verify-change/route";

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/auth/verify-change?token=${token}`
    : "http://localhost:3000/auth/verify-change";
  return new NextRequest(url);
}

const futureDate = new Date(Date.now() + 60 * 60 * 1000);

beforeEach(() => {
  vi.resetAllMocks();

  mockTransaction.mockImplementation(async (callback) =>
    callback({
      magicToken: { updateMany: mockUpdateManyMagicToken },
      user: { update: mockUpdateUser },
      rSVP: { updateMany: mockUpdateManyRsvps },
    })
  );

  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

const validRecord = {
  id: "tok-id",
  used: false,
  expiresAt: futureDate,
  userId: "user1",
  type: "EMAIL_CHANGE",
  metadata: "new@example.com",
};
beforeEach(() => {
  mockFindUniqueMagicToken.mockResolvedValue({ ...validRecord });
  mockFindUniqueUser.mockResolvedValue({ id: "user1", role: "HOST", email: "old@example.com" });
  mockFindFirstUser.mockResolvedValue(null);
  mockUpdateManyMagicToken.mockResolvedValue({ count: 1 });
  mockSealSession.mockResolvedValue("sealed");
});
describe("contact-change security regression", () => {
  it.each(["LOGIN", "UNKNOWN"])("rejects token type %s before writes", async (type) => {
    mockFindUniqueMagicToken.mockResolvedValue({ ...validRecord, type });
    const res = await GET(makeRequest("token"));
    expect(res.headers.get("location")).toContain("error=invalid-token");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
  it.each([{ used: true }, { expiresAt: new Date(0) }, { metadata: null }])(
    "rejects invalid token state %j",
    async (state) => {
      mockFindUniqueMagicToken.mockResolvedValue({ ...validRecord, ...state });
      const res = await GET(makeRequest("token"));
      expect(res.headers.get("location")).toContain("error=invalid-token");
      expect(mockTransaction).not.toHaveBeenCalled();
    }
  );
  it("preserves session email during a phone change", async () => {
    mockFindUniqueMagicToken.mockResolvedValue({
      ...validRecord,
      type: "PHONE_CHANGE",
      metadata: "+15555550123",
    });
    await GET(makeRequest("token"));
    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { phone: "+15555550123" },
    });
    expect(mockUpdateManyRsvps).toHaveBeenCalledWith({
      where: { userId: "user1" },
      data: { guestPhone: "+15555550123" },
    });
    expect(mockSealSession).toHaveBeenCalledWith(
      expect.objectContaining({ email: "old@example.com" })
    );
  });
  it("checks single-use, type and expiry again inside the transaction", async () => {
    await GET(makeRequest("token"));
    expect(mockUpdateManyMagicToken).toHaveBeenCalledWith({
      where: {
        id: "tok-id",
        used: false,
        type: "EMAIL_CHANGE",
        expiresAt: { gt: expect.any(Date) },
      },
      data: { used: true },
    });
  });
  it("rejects sequential replay even when the initial read is stale", async () => {
    mockUpdateManyMagicToken
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await GET(makeRequest("token"));
    const res = await GET(makeRequest("token"));
    expect(res.headers.get("location")).toContain("error=invalid-token");
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockLinkRsvpsToUser).toHaveBeenCalledTimes(1);
  });
  it.each(["user", "rsvp"])(
    "propagates %s write failure without issuing a session",
    async (stage) => {
      const failure = new Error("database failure");
      (stage === "user" ? mockUpdateUser : mockUpdateManyRsvps).mockRejectedValueOnce(failure);
      await expect(GET(makeRequest("token"))).rejects.toThrow(failure);
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockSealSession).not.toHaveBeenCalled();
      expect(mockLinkRsvpsToUser).not.toHaveBeenCalled();
    }
  );
  it("keeps all writes in the transaction and permits retry after simulated rollback", async () => {
    // This models Prisma rollback; real PostgreSQL rollback needs integration validation.
    let committedUsed = false;
    mockTransaction.mockImplementation(async (callback) => {
      let pendingUsed = committedUsed;
      const result = await callback({
        magicToken: {
          updateMany: async () => {
            if (pendingUsed) return { count: 0 };
            pendingUsed = true;
            return { count: 1 };
          },
        },
        user: { update: mockUpdateUser },
        rSVP: { updateMany: mockUpdateManyRsvps },
      });
      committedUsed = pendingUsed;
      return result;
    });
    mockUpdateManyRsvps
      .mockRejectedValueOnce(new Error("rollback"))
      .mockResolvedValue({ count: 1 });
    await expect(GET(makeRequest("token"))).rejects.toThrow("rollback");
    expect(committedUsed).toBe(false);
    const res = await GET(makeRequest("token"));
    expect(res.headers.get("location")).toContain("verified=1");
    expect(committedUsed).toBe(true);
  });
});
