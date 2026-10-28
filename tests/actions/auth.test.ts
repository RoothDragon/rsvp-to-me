import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the request-locale boundary; translation rendering remains the real English ICU catalog.
vi.mock("@/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/server")>();
  return { ...actual, getRequestTranslator: () => actual.getTranslator("en-US") };
});

const mocks = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockUserUpsert: vi.fn(),
  mockCreateMagicLink: vi.fn(),
  mockRegisterHost: vi.fn(),
  mockIsOpenRegistrationActive: vi.fn().mockResolvedValue(false),
  mockSendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
  mockSendMagicLinkSms: vi.fn().mockResolvedValue(undefined),
  mockRateLimit: vi.fn().mockResolvedValue({ success: true }),
  mockCookieGet: vi.fn(),
  mockRecipient: vi.fn().mockResolvedValue({ preferredLocale: null }),
  mockHeadersGet: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.mockRecipient,
      upsert: mocks.mockUserUpsert,
    },
    event: {
      findUnique: mocks.mockEventFindUnique,
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  createMagicLink: mocks.mockCreateMagicLink,
  registerHost: mocks.mockRegisterHost,
  isOpenRegistrationActive: mocks.mockIsOpenRegistrationActive,
}));

vi.mock("@/lib/email", () => ({
  sendMagicLinkEmail: mocks.mockSendMagicLinkEmail,
}));

vi.mock("@/lib/sms", () => ({
  sendMagicLinkSms: mocks.mockSendMagicLinkSms,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: mocks.mockRateLimit,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mocks.mockCookieGet }),
  headers: vi.fn().mockResolvedValue({
    get: mocks.mockHeadersGet,
  }),
}));

import {
  sendMagicLinkAction,
  registerHostAction,
  requestVerifiedGuestLinkAction,
} from "@/app/actions/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockRateLimit.mockResolvedValue({ success: true });
  // SEC-45: the per-IP sign-in limiter only runs when a trusted proxy IP is
  // configured. Default it on here so the two-tier (IP then identifier) tests
  // below exercise both limiters; individual tests override as needed.
  process.env.TRUSTED_IP_HEADER = "x-forwarded-for";
});

describe("sendMagicLinkAction", () => {
  it("returns error when identifier is too short (< 3 chars)", async () => {
    const result = await sendMagicLinkAction("ab");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid email or phone number format");
  });

  it("returns error when IP rate limit is exceeded", async () => {
    mocks.mockRateLimit.mockResolvedValueOnce({ success: false }); // IP rate limit fails

    const result = await sendMagicLinkAction("test@example.com");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many sign-in requests from this IP");
  });

  it("returns error when identifier rate limit is exceeded", async () => {
    mocks.mockRateLimit
      .mockResolvedValueOnce({ success: true }) // IP rate limit passes
      .mockResolvedValueOnce({ success: false }); // ID rate limit fails

    const result = await sendMagicLinkAction("test@example.com");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many sign-in requests for this email/phone");
  });

  it("skips the shared per-IP limiter when no trusted proxy is configured (SEC-45)", async () => {
    // Without TRUSTED_IP_HEADER, getClientIp() collapses to loopback, so an
    // IP-keyed limiter would be one global bucket that self-DoSes all sign-ins.
    // The action must fall through to the identifier limiter only.
    delete process.env.TRUSTED_IP_HEADER;
    mocks.mockCreateMagicLink.mockResolvedValue("http://localhost:3000/auth/verify?token=abc");

    const result = await sendMagicLinkAction("user@example.com");

    expect(result.success).toBe(true);
    // Only the identifier limiter is consulted — no ip:*:magic-link key.
    expect(mocks.mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.mockRateLimit).toHaveBeenCalledWith("id:user@example.com:magic-link", 5, 600);
  });

  it("returns success and sends nothing when user is not found (no enumeration, SEC-40)", async () => {
    mocks.mockCreateMagicLink.mockResolvedValue(null);

    const result = await sendMagicLinkAction("notfound@example.com");
    // Same response as a real send — must NOT reveal the account is absent.
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mocks.mockSendMagicLinkEmail).not.toHaveBeenCalled();
    expect(mocks.mockSendMagicLinkSms).not.toHaveBeenCalled();
  });

  it("returns auth_failed when email delivery throws an error", async () => {
    mocks.mockCreateMagicLink.mockResolvedValue("http://localhost:3000/auth/verify?token=abc");
    mocks.mockSendMagicLinkEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const result = await sendMagicLinkAction("user@example.com");
    expect(result.success).toBe(false);
    expect(result.error).toBe("auth_failed");
  });

  it("sends email and returns success:true when user is found regardless of redirect", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc&redirect=%2Fe%2Fpanton-wine-night";
    mocks.mockCreateMagicLink.mockResolvedValue(link);

    const result = await sendMagicLinkAction("host@example.com", "/e/panton-wine-night");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith("host@example.com", link, "en-US");
  });

  it("calls sendMagicLinkEmail when input is an email and user exists", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc";
    mocks.mockCreateMagicLink.mockResolvedValue(link);

    const result = await sendMagicLinkAction("user@example.com");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith("user@example.com", link, "en-US");
  });

  it("calls sendMagicLinkSms with normalized phone when input is a phone and user exists", async () => {
    const link = "http://localhost:3000/auth/verify?token=abc";
    mocks.mockCreateMagicLink.mockResolvedValue(link);

    const result = await sendMagicLinkAction("+1 (555) 123-4567");
    expect(result.success).toBe(true);
    expect(mocks.mockSendMagicLinkSms).toHaveBeenCalledWith("+15551234567", link, "en-US");
  });
});

describe("registerHostAction", () => {
  it("returns error for invalid email format", async () => {
    const result = await registerHostAction("invalid-email", "Joe", "code123");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid registration fields");
  });

  it("returns error when name is empty", async () => {
    const result = await registerHostAction("joe@example.com", "", "code123");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid registration fields");
  });

  it("returns error when IP rate limit is exceeded", async () => {
    mocks.mockRateLimit.mockResolvedValue({ success: false });

    const result = await registerHostAction("joe@example.com", "Joe", "code123");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many registration attempts");
  });
  it("delegates to registerHost with parsed email, name, inviteCode on success", async () => {
    mocks.mockIsOpenRegistrationActive.mockResolvedValue(false);
    mocks.mockRegisterHost.mockResolvedValue({ success: true });

    const result = await registerHostAction("joe@example.com", "Joe", "code123");
    expect(result.success).toBe(true);
    expect(mocks.mockRegisterHost).toHaveBeenCalledWith("joe@example.com", "Joe", "code123");
  });

  it("fails when open registration is disabled and inviteCode is empty", async () => {
    mocks.mockIsOpenRegistrationActive.mockResolvedValue(false);

    const result = await registerHostAction("joe@example.com", "Joe", "");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invite code is required");
    expect(mocks.mockRegisterHost).not.toHaveBeenCalled();
  });

  it("succeeds when open registration is enabled and inviteCode is empty", async () => {
    mocks.mockIsOpenRegistrationActive.mockResolvedValue(true);
    mocks.mockRegisterHost.mockResolvedValue({ success: true });

    const result = await registerHostAction("joe@example.com", "Joe", "");
    expect(result.success).toBe(true);
    expect(mocks.mockRegisterHost).toHaveBeenCalledWith("joe@example.com", "Joe", "");
  });

  describe("getClientIp headers priority", () => {
    beforeEach(() => {
      delete process.env.TRUSTED_IP_HEADER;
    });

    it("uses TRUSTED_IP_HEADER if set", async () => {
      process.env.TRUSTED_IP_HEADER = "x-my-custom-ip";
      mocks.mockHeadersGet.mockImplementation((h: string) => {
        if (h === "x-my-custom-ip") return "9.9.9.9";
        return "127.0.0.1";
      });
      await sendMagicLinkAction("test@example.com");
      expect(mocks.mockRateLimit).toHaveBeenCalledWith("ip:9.9.9.9:magic-link", 20, 600);
    });

    it("skips the per-IP limiter entirely when only spoofable headers are present (SEC-22 + SEC-45)", async () => {
      // Spoofable forwarding headers must NOT be trusted by default. Rather than
      // collapse to a single shared loopback bucket (which self-DoSes all
      // sign-ins), SEC-45 skips the per-IP limiter outright when no
      // TRUSTED_IP_HEADER is set — only the identifier limiter runs.
      mocks.mockHeadersGet.mockImplementation((h: string) => {
        if (h === "cf-connecting-ip") return "8.8.8.8";
        if (h === "x-real-ip") return "7.7.7.7";
        if (h === "x-forwarded-for") return "5.5.5.5, 4.4.4.4";
        return null;
      });
      await sendMagicLinkAction("test@example.com");
      expect(mocks.mockRateLimit).not.toHaveBeenCalledWith("ip:127.0.0.1:magic-link", 20, 600);
      expect(mocks.mockRateLimit).toHaveBeenCalledWith("id:test@example.com:magic-link", 5, 600);
    });

    it("uses the LAST hop of a trusted X-Forwarded-For chain (SEC-22)", async () => {
      // With a trusted proxy configured, the real client IP is the entry the
      // proxy appended (last), not the client-controlled first entry.
      process.env.TRUSTED_IP_HEADER = "x-forwarded-for";
      mocks.mockHeadersGet.mockImplementation((h: string) => {
        if (h === "x-forwarded-for") return "5.5.5.5, 4.4.4.4";
        return null;
      });
      await sendMagicLinkAction("test@example.com");
      expect(mocks.mockRateLimit).toHaveBeenCalledWith("ip:4.4.4.4:magic-link", 20, 600);
    });
  });
});

describe("magic-link recipient language", () => {
  beforeEach(() => {
    mocks.mockRecipient.mockResolvedValue({ preferredLocale: null });
    mocks.mockCookieGet.mockReturnValue(undefined);
    mocks.mockCreateMagicLink.mockResolvedValue("http://localhost:3000/auth/verify?token=language");
  });
  it("uses saved recipient preference ahead of requesting browser", async () => {
    mocks.mockRecipient.mockResolvedValue({ preferredLocale: "nl-NL" });
    mocks.mockCookieGet.mockReturnValue({ value: "en-US" });
    await sendMagicLinkAction("known@example.com");
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "known@example.com",
      expect.any(String),
      "nl-NL"
    );
  });
  it("uses browser cookie for an unset recipient without persisting it", async () => {
    mocks.mockCookieGet.mockReturnValue({ value: "nl-NL" });
    await sendMagicLinkAction("known@example.com");
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "known@example.com",
      expect.any(String),
      "nl-NL"
    );
    expect(mocks.mockRecipient).toHaveBeenCalledWith({
      where: { email: "known@example.com" },
      select: { preferredLocale: true },
    });
  });
  it("uses English for corrupt saved preference rather than requesting browser", async () => {
    mocks.mockRecipient.mockResolvedValue({ preferredLocale: "invalid" });
    mocks.mockCookieGet.mockReturnValue({ value: "nl-NL" });
    await sendMagicLinkAction("known@example.com");
    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "known@example.com",
      expect.any(String),
      "en-US"
    );
  });
});

describe("requestVerifiedGuestLinkAction", () => {
  beforeEach(() => {
    mocks.mockEventFindUnique.mockResolvedValue({
      slug: "testing-public-event",
      status: "PUBLISHED",
      startAt: new Date("2027-12-19T21:00:00Z"),
      requireVerifiedRsvp: true,
    });

    mocks.mockUserUpsert.mockResolvedValue({
      preferredLocale: null,
    });

    mocks.mockCreateMagicLink.mockResolvedValue(
      "http://localhost:3000/auth/verify?token=test-token&redirect=%2Fe%2Ftesting-public-event"
    );
  });

  it("creates a GUEST account and emails a magic link for an eligible event", async () => {
    const result = await requestVerifiedGuestLinkAction(
      " NewGuest@Example.com ",
      "testing-public-event"
    );

    expect(result.success).toBe(true);

    expect(mocks.mockEventFindUnique).toHaveBeenCalledWith({
      where: { slug: "testing-public-event" },
      select: {
        slug: true,
        status: true,
        startAt: true,
        requireVerifiedRsvp: true,
      },
    });

    expect(mocks.mockUserUpsert).toHaveBeenCalledWith({
      where: { email: "newguest@example.com" },
      create: {
        email: "newguest@example.com",
        role: "GUEST",
      },
      update: {},
      select: { preferredLocale: true },
    });

    expect(mocks.mockCreateMagicLink).toHaveBeenCalledWith(
      "newguest@example.com",
      "/e/testing-public-event"
    );

    expect(mocks.mockSendMagicLinkEmail).toHaveBeenCalledWith(
      "newguest@example.com",
      expect.stringContaining("/auth/verify?token="),
      "en-US"
    );
  });
});