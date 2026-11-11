// Root cause (October 2026): getSession accepted a live backing session without
// binding its userId and session id to the sealed cookie, including cache hits.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSealData: vi.fn().mockResolvedValue("sealed-value"),
  mockUnsealData: vi.fn(),
  mockCookiesGet: vi.fn(),
  mockCookiesSet: vi.fn(),
  mockCookiesDelete: vi.fn(),
  mockSessionCreate: vi.fn(),
  mockSessionFindUnique: vi.fn(),
  mockSessionDelete: vi.fn(),
  mockSessionFindMany: vi.fn(),
  mockIsRedisEnabled: vi.fn().mockReturnValue(false),
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
}));

vi.mock("iron-session", () => ({
  sealData: mocks.mockSealData,
  unsealData: mocks.mockUnsealData,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mocks.mockCookiesGet,
    set: mocks.mockCookiesSet,
    delete: mocks.mockCookiesDelete,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    session: {
      create: mocks.mockSessionCreate,
      findUnique: mocks.mockSessionFindUnique,
      delete: mocks.mockSessionDelete,
      findMany: mocks.mockSessionFindMany,
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  isRedisEnabled: mocks.mockIsRedisEnabled,
  redisGet: mocks.mockRedisGet,
  redisSet: mocks.mockRedisSet,
  redisDel: mocks.mockRedisDel,
}));

import { getSession } from "@/lib/session";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockSessionFindUnique.mockReset();
  mocks.mockRedisGet.mockReset();
  mocks.mockUnsealData.mockReset();
  mocks.mockIsRedisEnabled.mockReturnValue(false);
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
});

describe("session identity binding", () => {
  it.each(["database", "redis"])("rejects a mismatched owner from %s", async (source) => {
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "victim",
      sessionId: "session",
      role: "ADMIN",
    });
    const expiresAt = new Date(Date.now() + 60000);
    if (source === "redis") {
      mocks.mockIsRedisEnabled.mockReturnValue(true);
      mocks.mockRedisGet.mockResolvedValue(
        JSON.stringify({
          id: "session",
          userId: "different-user",
          expiresAt: expiresAt.toISOString(),
          userRole: "GUEST",
        })
      );
    } else {
      mocks.mockSessionFindUnique.mockResolvedValue({
        id: "session",
        userId: "different-user",
        expiresAt,
        user: { role: "GUEST" },
      });
    }
    expect(await getSession()).toBeNull();
  });
  it("rejects a mismatched cached session id", async () => {
    mocks.mockCookiesGet.mockReturnValue({ value: "sealed" });
    mocks.mockUnsealData.mockResolvedValue({
      userId: "owner",
      sessionId: "session",
      role: "GUEST",
    });
    mocks.mockIsRedisEnabled.mockReturnValue(true);
    mocks.mockRedisGet.mockResolvedValue(
      JSON.stringify({
        id: "other-session",
        userId: "owner",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        userRole: "GUEST",
      })
    );
    expect(await getSession()).toBeNull();
  });
});
