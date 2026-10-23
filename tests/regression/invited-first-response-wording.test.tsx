// @vitest-environment jsdom
// Regression (2026-10-23 browser QA of #749 named invitations, fixed in cb58e723):
// an invited guest's first answer was framed as an edit ("Update RSVP" button,
// "RSVP updated!" screen). Root cause: RsvpFlow treated any token link as an
// edit. The RSVP page now passes `responded`; the first-response framing is
// pinned at mount so the post-submit refresh cannot flip it to "updated".
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/components/render";
import { testTheme } from "@/tests/components/helpers/theme";

const { mockUpdateRSVP, mockUpdateRsvpAsHost } = vi.hoisted(() => ({
  mockUpdateRSVP: vi.fn(),
  mockUpdateRsvpAsHost: vi.fn(),
}));
vi.mock("@/app/actions/event", () => ({
  addRSVP: vi.fn(),
  updateRSVP: mockUpdateRSVP,
  updateRsvpAsHost: mockUpdateRsvpAsHost,
}));

import { RsvpFlow } from "@/components/rsvp/RsvpFlow";

const event = {
  id: "event-1",
  slug: "party",
  title: "Party",
  startAt: new Date("2030-12-01T20:00:00Z"),
  endAt: null,
  timezone: "UTC",
  locationName: null,
  plusOneAllowed: false,
  plusOneMax: 0,
  plusOneNamesRequired: false,
  maybeEnabled: true,
  questionnaireEnabled: false,
  rsvpFields: [],
};

const invitee = {
  id: "rsvp-1",
  editToken: "tok-1",
  guestName: "Alice",
  status: "GOING" as const,
  plusOneCount: 0,
  note: null,
  plusOneGuests: [],
  answers: [],
  hasContact: true,
  responded: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateRSVP.mockResolvedValue({ success: true });
  mockUpdateRsvpAsHost.mockResolvedValue({ success: true });
});

describe("an invited guest's first response", () => {
  it("is framed as an RSVP, not an update, through the post-submit refresh", async () => {
    const { rerender } = render(
      <RsvpFlow event={event} theme={testTheme} existingRsvp={invitee} />
    );
    expect(screen.queryByRole("button", { name: "Update RSVP" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm RSVP" }));
    await waitFor(() => expect(screen.getByText("You're in!")).toBeInTheDocument());
    expect(mockUpdateRSVP).toHaveBeenCalledWith("tok-1", expect.any(Object), null);

    // The Server Action refresh delivers the now-responded RSVP.
    rerender(
      <RsvpFlow event={event} theme={testTheme} existingRsvp={{ ...invitee, responded: true }} />
    );
    expect(screen.getByText("You're in!")).toBeInTheDocument();
    expect(screen.queryByText("RSVP updated!")).not.toBeInTheDocument();
  });

  it("keeps update wording for later edits and for hosts answering on a guest's behalf", () => {
    const { unmount } = render(
      <RsvpFlow event={event} theme={testTheme} existingRsvp={{ ...invitee, responded: true }} />
    );
    expect(screen.getByRole("button", { name: "Update RSVP" })).toBeInTheDocument();
    unmount();
    render(<RsvpFlow event={event} theme={testTheme} existingRsvp={invitee} organizerOverride />);
    expect(screen.getByRole("button", { name: "Update RSVP" })).toBeInTheDocument();
  });
});
