// Root cause: invite-token routes skipped verification, then updateRSVP rejected
// the completed questionnaire. Unlinked invitees also had no owner to sign in as.
// Recovery sends only to current saved contacts and returns to the same RSVP.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rsvp: vi.fn(),
  upsert: vi.fn(),
  link: vi.fn(),
  email: vi.fn(),
  sms: vi.fn(),
  limit: vi.fn(),
  captcha: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { rSVP: { findUnique: m.rsvp }, user: { upsert: m.upsert } } }));
vi.mock("@/lib/auth", () => ({ createMagicLink: m.link }));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: m.email }));
vi.mock("@/lib/sms", () => ({ sendMagicLinkSms: m.sms }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: m.captcha }));
vi.mock("@/lib/clientIp", () => ({ isTrustedIpConfigured: () => false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { requestRsvpOwnerLinkAction } from "@/app/actions/auth";

const invitation = {
  userId: null,
  user: null,
  guestEmail: "alice@example.com",
  guestPhone: null,
  event: {
    slug: "private-party",
    status: "PUBLISHED",
    requireVerifiedRsvp: true,
    startAt: new Date("2099-01-01"),
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.rsvp.mockResolvedValue(invitation);
  m.upsert.mockResolvedValue({ preferredLocale: null });
  m.link.mockResolvedValue("https://example.com/auth/verify?token=secret");
  m.limit.mockResolvedValue({ success: true });
});

describe("invited RSVP owner recovery", () => {
  it("creates a guest account without assigning ownership before verification", async () => {
    expect(await requestRsvpOwnerLinkAction("invite-token", "MAYBE", "captcha")).toEqual({
      success: true,
    });
    expect(m.captcha).toHaveBeenCalledWith("signin", "captcha");
    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "alice@example.com" },
        create: { email: "alice@example.com", role: "GUEST" },
        update: {},
      })
    );
    expect(m.link).toHaveBeenCalledWith(
      "alice@example.com",
      "/e/private-party/rsvp?token=invite-token&status=MAYBE"
    );
    expect(m.email).toHaveBeenCalledWith("alice@example.com", expect.any(String), "en-US");
    expect(m.sms).not.toHaveBeenCalled();
  });
  it("supports phone-only invitations", async () => {
    m.rsvp.mockResolvedValue({ ...invitation, guestEmail: null, guestPhone: "+1 (202) 555-0123" });
    expect((await requestRsvpOwnerLinkAction("invite-token", "NO")).success).toBe(true);
    expect(m.link).toHaveBeenCalledWith("+12025550123", expect.stringContaining("status=NO"));
    expect(m.sms).toHaveBeenCalledWith("+12025550123", expect.any(String), "en-US");
    expect(m.email).not.toHaveBeenCalled();
  });
  it("allows the linked owner's matching saved contact", async () => {
    m.rsvp.mockResolvedValue({
      ...invitation,
      userId: "owner",
      user: { id: "owner", email: "alice@example.com" },
    });
    expect((await requestRsvpOwnerLinkAction("invite-token", "GOING")).success).toBe(true);
  });
  it.each([
    null,
    { ...invitation, guestEmail: null },
    { ...invitation, userId: "owner", user: { id: "owner", email: "other@example.com" } },
    { ...invitation, event: { ...invitation.event, status: "CANCELLED" } },
    { ...invitation, event: { ...invitation.event, requireVerifiedRsvp: false } },
    { ...invitation, event: { ...invitation.event, startAt: new Date(0) } },
  ])("rejects an ineligible RSVP without sending or creating an account (%#)", async (rsvp) => {
    m.rsvp.mockResolvedValue(rsvp);
    expect((await requestRsvpOwnerLinkAction("invite-token", "GOING")).success).toBe(false);
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.link).not.toHaveBeenCalled();
  });
  it("rate limits delivery to the saved contact", async () => {
    m.limit.mockResolvedValue({ success: false });
    expect((await requestRsvpOwnerLinkAction("invite-token", "GOING")).success).toBe(false);
    expect(m.limit).toHaveBeenCalledWith("id:alice@example.com:magic-link", 5, 600);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("does not report success on delivery failure", async () => {
    m.email.mockRejectedValue(new Error("delivery failed"));
    expect((await requestRsvpOwnerLinkAction("invite-token", "GOING")).success).toBe(false);
  });
  it("rejects malformed requests before looking up the RSVP", async () => {
    expect((await requestRsvpOwnerLinkAction("", "GOING")).success).toBe(false);
    expect((await requestRsvpOwnerLinkAction("invite-token", "INVITED")).success).toBe(false);
    expect(m.rsvp).not.toHaveBeenCalled();
  });
});
