// #749: concurrent reviewed-new invitations must create one event RSVP and send
// only the first reviewed batch. Exercise PostgreSQL transaction advisory locks.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, truncateAll } from "../helpers/db";
const mocks = vi.hoisted(() => ({ session: vi.fn(), email: vi.fn(), sms: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock("@/lib/config", () => ({
  getChannelConfig: vi.fn().mockResolvedValue({ email: true, sms: true }),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({ sendEventInviteEmail: mocks.email }));
vi.mock("@/lib/sms", () => ({ sendEventInviteSms: mocks.sms }));

import {
  inviteGuest,
  inviteFriendAsGuest,
  previewGuestInvitations,
  sendGuestInvitations,
} from "@/app/actions/event/invites";

beforeEach(async () => {
  await truncateAll();
  vi.clearAllMocks();
  mocks.email.mockResolvedValue(undefined);
  mocks.sms.mockResolvedValue(undefined);
});

async function fixture() {
  const host = await db.user.create({
    data: { email: "host749@example.com", role: "HOST", name: "Host" },
  });
  const guest = await db.user.create({
    data: { email: "guest749@example.com", name: "Account name" },
  });
  const event = await db.event.create({
    data: {
      title: "Invitation Race",
      slug: "invitation-race",
      hostId: host.id,
      startAt: new Date("2099-01-01"),
      timezone: "UTC",
      locationType: "TBD",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      guestsCanInvite: true,
    },
  });
  mocks.session.mockResolvedValue({ userId: host.id, email: host.email, role: "HOST" });
  return { host, guest, event };
}

describe("#749 invitations — PostgreSQL serialization", () => {
  it("allows one of two concurrent new reviews for the same existing account and event", async () => {
    const { guest, event } = await fixture();
    const recipient = { contact: guest.email!, name: "Event name" };
    const preview = (await previewGuestInvitations(event.id, [recipient])).recipients[0];
    expect(preview.disposition).toBe("new");
    const reviewed = {
      ...recipient,
      expectedDisposition: "new" as const,
      expectedGuestName: preview.guestName,
    };
    const results = await Promise.all([
      sendGuestInvitations(event.id, [reviewed]),
      sendGuestInvitations(event.id, [reviewed]),
    ]);
    expect(results.map((r) => r.results[0].status).sort()).toEqual(["failed", "sent"]);
    expect(results.find((r) => !r.success)?.results[0].error).toContain("changed");
    expect(await db.rSVP.count({ where: { eventId: event.id, userId: guest.id } })).toBe(1);
    expect(await db.invitation.count({ where: { eventId: event.id, sentTo: guest.email! } })).toBe(
      1
    );
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: guest.id } })).name).toBe(
      "Account name"
    );
  });

  it("shares the same lock across legacy host and guest invitations", async () => {
    const { guest, event } = await fixture();
    const inviter = await db.rSVP.create({
      data: {
        eventId: event.id,
        guestName: "Inviter",
        status: "GOING",
        responded: true,
        approved: true,
      },
    });
    const results = await Promise.all([
      inviteGuest(event.id, `"Host supplied" <${guest.email}>`),
      inviteFriendAsGuest(event.id, inviter.editToken, guest.email!, null, "Friend supplied"),
    ]);
    expect(results.every((result) => result.success)).toBe(true);
    const rows = await db.rSVP.findMany({ where: { eventId: event.id, userId: guest.id } });
    expect(rows).toHaveLength(1);
    expect(["Host supplied", "Friend supplied"]).toContain(rows[0].guestName);
    expect(await db.invitation.count({ where: { eventId: event.id, sentTo: guest.email! } })).toBe(
      1
    );
    expect(mocks.email).toHaveBeenCalledTimes(2);
    expect(mocks.email.mock.calls.map((call) => call[1].rsvpBaseUrl)).toEqual([
      expect.stringContaining(rows[0].editToken),
      expect.stringContaining(rows[0].editToken),
    ]);
  });
});
