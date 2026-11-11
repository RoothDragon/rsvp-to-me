// Root cause (2026-11-10): front-door sign-in returned success for unknown
// emails but created no account/token and sent no email. Event signup did work.
// Both new and existing emails must now take the same verified GUEST-safe path.
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  upsert: vi.fn(),
  recipient: vi.fn(),
  link: vi.fn(),
  email: vi.fn(),
  sms: vi.fn(),
  limit: vi.fn(),
  captcha: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { user: { upsert: m.upsert, findUnique: m.recipient } } }));
vi.mock("@/lib/auth", () => ({ createMagicLink: m.link }));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: m.email }));
vi.mock("@/lib/sms", () => ({ sendMagicLinkSms: m.sms }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: m.captcha }));
vi.mock("@/lib/clientIp", () => ({ isTrustedIpConfigured: () => false }));
vi.mock("@/i18n/server", () => ({ getRequestTranslator: async () => (key: string) => key }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { sendMagicLinkAction } from "@/app/actions/auth";
beforeEach(() => {
  vi.resetAllMocks();
  m.limit.mockResolvedValue({ success: true });
  m.link.mockResolvedValue("https://example.com/auth/verify?token=test");
  m.recipient.mockResolvedValue({ preferredLocale: null });
});
describe("front-door guest email signup", () => {
  it.each(["new", "GUEST", "HOST", "ADMIN"])(
    "sends the same response and link for a %s account",
    async (role) => {
      m.upsert.mockResolvedValue({ id: "account", role });
      expect(
        await sendMagicLinkAction(" New@Example.com ", "/e/party/rsvp?status=MAYBE", "captcha")
      ).toEqual({ success: true });
      expect(m.captcha).toHaveBeenCalledWith("signin", "captcha");
      expect(m.upsert).toHaveBeenCalledWith({
        where: { email: "new@example.com" },
        create: { email: "new@example.com", role: "GUEST" },
        update: {},
        select: { id: true },
      });
      expect(m.link).toHaveBeenCalledWith("New@Example.com", "/e/party/rsvp?status=MAYBE");
      expect(m.email).toHaveBeenCalledWith("new@example.com", expect.any(String), "en-US");
      expect(m.sms).not.toHaveBeenCalled();
      expect(m.upsert.mock.invocationCallOrder[0]).toBeLessThan(m.link.mock.invocationCallOrder[0]);
    }
  );
  it("blocks invalid email before account creation or mail", async () => {
    expect((await sendMagicLinkAction("not-an-email")).success).toBe(false);
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.link).not.toHaveBeenCalled();
  });
  it("applies rate limits before account creation", async () => {
    m.limit.mockResolvedValue({ success: false });
    expect((await sendMagicLinkAction("new@example.com")).success).toBe(false);
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });
  it("does not create an account when configured CAPTCHA rejects the request", async () => {
    m.captcha.mockRejectedValue(new Error("captcha rejected"));
    await expect(sendMagicLinkAction("new@example.com")).rejects.toThrow("captcha rejected");
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });
  it("reports delivery failure instead of claiming an email was sent", async () => {
    m.email.mockRejectedValue(new Error("delivery failed"));
    expect(await sendMagicLinkAction("new@example.com")).toEqual({
      success: false,
      error: "auth_failed",
    });
  });
  it("keeps existing-account SMS sign-in without registering new phone accounts", async () => {
    await sendMagicLinkAction("+1 (202) 555-0123");
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.sms).toHaveBeenCalledWith("+12025550123", expect.any(String), "en-US");
  });
});
