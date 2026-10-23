// Guest-list Resend could send a stale invitation without the host reviewing it.
//
// Bug (found 2026-10, follow-up to #749): the Resend invite button still called the
// legacy inviteGuest action. It resolved the guest at send time without comparing
// against what the host saw on the card, so a guest who had replied, been renamed,
// or become a contact conflict since the list loaded was resent silently and the
// host was told "Invite resent".
//
// Fix: Resend previews the one recipient, refuses to send when the preview no
// longer matches the card, and otherwise sends through sendGuestInvitations with
// the reviewed disposition and name, which the server re-checks under the
// invitation lock. Any review failure is shown instead of a success message.

// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/tests/components/render";
import { testTheme } from "@/tests/components/helpers/theme";

const mocks = vi.hoisted(() => ({
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
  inviteGuest: vi.fn(),
}));

vi.mock("@/app/actions/event", () => ({
  addWalkIn: vi.fn(),
  approveRsvp: vi.fn(),
  checkInRsvp: vi.fn(),
  declineRsvp: vi.fn(),
  deleteInvitationAsHost: vi.fn(),
  deleteRsvpAsHost: vi.fn(),
  previewGuestInvitations: mocks.previewGuestInvitations,
  sendGuestInvitations: mocks.sendGuestInvitations,
  // Retired: present only so a regression back to it would be observable.
  inviteGuest: mocks.inviteGuest,
  undoCheckIn: vi.fn(),
}));
vi.mock("next/image", () => ({ default: () => null }));

import { GuestListFilter } from "@/components/event/GuestListFilter";

const CHANGED = /replied or changed since the list loaded/;
const RESENT = /Invite resent/;

const invitedCard = {
  id: "rsvp-1",
  rsvpId: "rsvp-1",
  sentTo: "ada@example.com",
  channel: "EMAIL" as const,
  sentAt: "2026-10-01T18:00:00.000Z",
  guestName: "Ada Guest",
  editToken: "ada-token",
  plusOneCount: 0,
  checkIn: null,
};

function preview(overrides: Record<string, unknown> = {}) {
  return {
    recipients: [
      {
        contact: "ada@example.com",
        guestName: "Ada Guest",
        disposition: "invited",
        channel: "EMAIL",
        ...overrides,
      },
    ],
  };
}

function renderCard(card: ComponentProps<typeof GuestListFilter>["invited"][number] = invitedCard) {
  render(
    <GuestListFilter
      going={[]}
      maybe={[]}
      no={[]}
      invited={[card]}
      isHost
      eventId="event-1"
      slug="party"
      timezone="UTC"
      channelConfig={{ email: true, sms: true }}
      t={testTheme}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Resend invite" }));
}

describe("guest-list Resend cannot silently send a stale invitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["the guest replied after the list loaded", { disposition: "responded" }],
    ["the guest's event name changed", { guestName: "Ada Renamed" }],
  ])("does not send when %s", async (_case, changed) => {
    mocks.previewGuestInvitations.mockResolvedValue(preview(changed));
    renderCard();

    expect(await screen.findByText(CHANGED)).toBeTruthy();
    expect(mocks.previewGuestInvitations).toHaveBeenCalledWith("event-1", [
      { contact: "ada@example.com" },
    ]);
    expect(mocks.sendGuestInvitations).not.toHaveBeenCalled();
    expect(mocks.inviteGuest).not.toHaveBeenCalled();
    expect(screen.queryByText(RESENT)).toBeNull();
  });

  it("does not send when the contact now matches conflicting guest records", async () => {
    mocks.previewGuestInvitations.mockResolvedValue(preview({ disposition: "conflict" }));
    renderCard();

    expect(await screen.findByText(/Resolve the guest records/)).toBeTruthy();
    expect(mocks.sendGuestInvitations).not.toHaveBeenCalled();
    expect(mocks.inviteGuest).not.toHaveBeenCalled();
  });

  it("shows the server's review failure when the guest changes between preview and send", async () => {
    mocks.previewGuestInvitations.mockResolvedValue(preview());
    mocks.sendGuestInvitations.mockResolvedValue({
      success: false,
      results: [
        {
          contact: "ada@example.com",
          status: "failed",
          error: "This guest changed since the preview. Review the invitation again.",
        },
      ],
    });
    renderCard();

    expect(await screen.findByText(/Review the invitation again/)).toBeTruthy();
    expect(mocks.sendGuestInvitations).toHaveBeenCalledWith(
      "event-1",
      [
        {
          contact: "ada@example.com",
          expectedDisposition: "invited",
          expectedGuestName: "Ada Guest",
        },
      ],
      null
    );
    expect(screen.queryByText(RESENT)).toBeNull();
  });

  it("resends an unlinked invitation under the name the preview showed", async () => {
    mocks.previewGuestInvitations.mockResolvedValue(preview({ guestName: "Guest" }));
    mocks.sendGuestInvitations.mockResolvedValue({
      success: true,
      results: [{ contact: "ada@example.com", status: "sent", guestName: "Guest" }],
    });
    renderCard({
      id: "invitation-1",
      sentTo: "ada@example.com",
      channel: "EMAIL",
      sentAt: "2026-10-01T18:00:00.000Z",
    });

    expect(await screen.findByText("Invite resent to ada@example.com.")).toBeTruthy();
    expect(mocks.sendGuestInvitations).toHaveBeenCalledWith(
      "event-1",
      [{ contact: "ada@example.com", expectedDisposition: "invited", expectedGuestName: "Guest" }],
      null
    );
  });
});
