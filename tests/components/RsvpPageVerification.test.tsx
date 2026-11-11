import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/components/render";

const mocks = vi.hoisted(() => ({
  findEvent: vi.fn(),
  findRsvp: vi.fn(),
  ownerGate: vi.fn(() => null),
  getSessionUser: vi.fn(),
  getSession: vi.fn(),
  access: vi.fn(),
  redirect: vi.fn(),
  flow: vi.fn(() => null),
  gate: vi.fn(() => null),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mocks.findEvent },
    rSVP: { findUnique: mocks.findRsvp },
  },
}));

vi.mock("@/lib/session-user", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/eventAccess", () => ({
  resolveEventAccess: mocks.access,
}));

vi.mock("@/lib/config", () => ({
  getChannelConfig: vi.fn().mockResolvedValue({
    email: true,
    sms: true,
  }),
}));

vi.mock("@/lib/theme", () => ({
  resolveTheme: vi.fn(() => ({})),
}));

vi.mock("@/lib/effects", () => ({
  resolveEffectConfig: vi.fn(() => null),
}));

vi.mock("@/components/rsvp/RsvpFlow", () => ({
  RsvpFlow: mocks.flow,
}));

vi.mock("@/components/rsvp/VerifiedRsvpGate", () => ({
  VerifiedRsvpGate: mocks.gate,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: mocks.redirect,
}));

vi.mock("@/i18n/server", () => ({
  getRequestTranslator: vi.fn(async () => (key: string) => key),
}));

import RsvpPage from "@/app/e/[slug]/rsvp/page";

vi.mock("@/components/rsvp/RsvpOwnerGate", () => ({ RsvpOwnerGate: mocks.ownerGate }));

const baseEvent = {
  id: "event-1",
  slug: "test-party",
  title: "Test Party",
  hostId: "host-1",
  status: "PUBLISHED",
  startAt: new Date("2030-12-01T20:00:00Z"),
  endAt: null,
  rsvpDeadline: null,
  allowEditAfterDeadline: false,
  requireVerifiedRsvp: true,
  visibility: "UNLISTED",
  passwordHash: null,
  timezone: "UTC",
  locationName: null,
  plusOneAllowed: false,
  plusOneMax: 0,
  plusOneNamesRequired: false,
  maybeEnabled: true,
  questionnaireEnabled: false,
  theme: null,
  coHosts: [],
  rsvpFields: [],
  polls: [],
  potluckItems: [],
};

const alice = {
  id: "alice-id",
  email: "alice@example.com",
  name: "Alice",
  role: "GUEST",
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.findEvent.mockResolvedValue(baseEvent);
  mocks.getSessionUser.mockResolvedValue(null);
  mocks.getSession.mockResolvedValue(null);

  mocks.access.mockResolvedValue({
    decision: "granted",
    isHost: false,
    sessionUser: null,
    isLoggedInGuest: false,
    hasValidToken: false,
  });

  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

async function renderPage() {
  const element = await RsvpPage({
    params: Promise.resolve({ slug: "test-party" }),
    searchParams: Promise.resolve({ status: "GOING" }),
  });

  render(element);
}

describe("RSVP page verification gate", () => {
  const invitation = {
    id: "rsvp-1",
    eventId: "event-1",
    editToken: "invite-token",
    userId: null,
    guestName: "Alice",
    guestEmail: "alice@example.com",
    status: "INVITED",
    plusOneGuests: [],
    answers: [],
    responded: false,
  };
  async function renderInvitation() {
    render(
      await RsvpPage({
        params: Promise.resolve({ slug: "test-party" }),
        searchParams: Promise.resolve({ token: "invite-token", status: "MAYBE" }),
      })
    );
  }
  it.each([null, { userId: "other" }, { userId: "alice-id" }])(
    "gates unlinked invitations before questionnaire entry (%#)",
    async (session) => {
      mocks.findRsvp.mockResolvedValue(invitation);
      mocks.getSession.mockResolvedValue(session);
      await renderInvitation();
      expect(mocks.ownerGate).toHaveBeenCalledWith(
        expect.objectContaining({ editToken: "invite-token", status: "MAYBE" }),
        undefined
      );
      expect(mocks.flow).not.toHaveBeenCalled();
    }
  );
  it("gates a linked response when signed in as a different account", async () => {
    mocks.findRsvp.mockResolvedValue({ ...invitation, userId: "alice-id" });
    mocks.getSession.mockResolvedValue({ userId: "other" });
    await renderInvitation();
    expect(mocks.ownerGate).toHaveBeenCalled();
    expect(mocks.flow).not.toHaveBeenCalled();
  });
  it("lets the signed-in RSVP owner answer questions", async () => {
    mocks.findRsvp.mockResolvedValue({ ...invitation, userId: "alice-id" });
    mocks.getSession.mockResolvedValue({ userId: "alice-id" });
    await renderInvitation();
    expect(mocks.flow).toHaveBeenCalled();
    expect(mocks.ownerGate).not.toHaveBeenCalled();
  });
  it("preserves token-only edits for events without verification", async () => {
    mocks.findRsvp.mockResolvedValue(invitation);
    mocks.findEvent.mockResolvedValue({ ...baseEvent, requireVerifiedRsvp: false });
    await renderInvitation();
    expect(mocks.flow).toHaveBeenCalled();
    expect(mocks.ownerGate).not.toHaveBeenCalled();
  });
  it("preserves organizer edits", async () => {
    mocks.findRsvp.mockResolvedValue(invitation);
    mocks.getSessionUser.mockResolvedValue({ id: "host-1", role: "HOST" });
    await renderInvitation();
    expect(mocks.flow).toHaveBeenCalledWith(
      expect.objectContaining({ organizerOverride: true }),
      undefined
    );
    expect(mocks.ownerGate).not.toHaveBeenCalled();
  });
  it("preserves the ordinary RSVP flow when verification is disabled", async () => {
    mocks.findEvent.mockResolvedValue({
      ...baseEvent,
      requireVerifiedRsvp: false,
    });

    await renderPage();

    expect(mocks.flow).toHaveBeenCalled();
    expect(mocks.gate).not.toHaveBeenCalled();
  });

  it("shows the gate for an anonymous guest", async () => {
    await renderPage();

    expect(mocks.gate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventSlug: "test-party",
        status: "GOING",
      }),
      undefined
    );

    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it("shows the gate for a session without verified contact", async () => {
    mocks.getSessionUser.mockResolvedValue(alice);
    mocks.getSession.mockResolvedValue({
      userId: "alice-id",
      email: "alice@example.com",
      role: "GUEST",
    });

    await renderPage();

    expect(mocks.gate).toHaveBeenCalled();
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it("allows a matching verified-email session into the RSVP form", async () => {
    mocks.getSessionUser.mockResolvedValue(alice);
    mocks.getSession.mockResolvedValue({
      userId: "alice-id",
      email: "alice@example.com",
      role: "GUEST",
      verifiedMethod: "EMAIL",
      verifiedIdentifier: "alice@example.com",
    });

    await renderPage();

    expect(mocks.flow).toHaveBeenCalledWith(
      expect.objectContaining({
        verifiedEmail: "alice@example.com",
      }),
      undefined
    );

    expect(mocks.gate).not.toHaveBeenCalled();
  });

  it("rejects mismatched verified email evidence", async () => {
    mocks.getSessionUser.mockResolvedValue(alice);
    mocks.getSession.mockResolvedValue({
      userId: "alice-id",
      email: "alice@example.com",
      role: "GUEST",
      verifiedMethod: "EMAIL",
      verifiedIdentifier: "bob@example.com",
    });

    await renderPage();

    expect(mocks.gate).toHaveBeenCalled();
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it("rejects verification evidence belonging to a different user", async () => {
    mocks.getSessionUser.mockResolvedValue(alice);
    mocks.getSession.mockResolvedValue({
      userId: "bob-id",
      email: "alice@example.com",
      role: "GUEST",
      verifiedMethod: "EMAIL",
      verifiedIdentifier: "alice@example.com",
    });

    await renderPage();

    expect(mocks.gate).toHaveBeenCalled();
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it("preserves PRIVATE-event authorization before verification", async () => {
    mocks.findEvent.mockResolvedValue({
      ...baseEvent,
      visibility: "PRIVATE",
    });
    mocks.access.mockResolvedValue({
      decision: "private-blocked",
    });

    await expect(renderPage()).rejects.toThrow("REDIRECT:/e/test-party");

    expect(mocks.gate).not.toHaveBeenCalled();
    expect(mocks.flow).not.toHaveBeenCalled();
  });
});
