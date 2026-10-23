// @vitest-environment jsdom
// Regression (2026-10-23 browser QA of #749 named invitations, fixed in cb58e723).
// Root causes in the textarea-backed composer:
// - Row inputs committed on blur and were keyed by source offsets, so Tab after
//   editing a name remounted the row and dropped focus to <body>.
// - Draft state lived inside the dialog, so Esc, × or a backdrop click silently
//   discarded every unsent recipient.
// - Recipients on a disabled channel passed the draft and surfaced only at review
//   as an unexplained disabled checkbox.
// The rows-first composer keys rows by stable id, HostBar owns the draft, and
// rows explain disabled channels in place.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@/tests/components/render";
import { testTheme } from "@/tests/components/helpers/theme";
vi.mock("@/app/actions/event", () => ({
  sendBlast: vi.fn(),
  sendSmsBlast: vi.fn(),
  saveEventSettings: vi.fn(),
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
  getEventEmailPreview: vi.fn(),
}));
import { HostBar } from "@/components/event/HostBar";

function openInvite(channelConfig = { email: true, sms: true }) {
  render(
    <HostBar
      eventId="event-1"
      eventSlug="party"
      theme={testTheme}
      visibility="PUBLIC"
      channelConfig={channelConfig}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Invite" }));
}

describe("invitation composer QA regressions", () => {
  it("keeps keyboard focus moving from name to contact after editing a name", async () => {
    openInvite();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Name for recipient 1" }), "Carol QA");
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Email or phone for recipient 1" })).toHaveFocus();
  });

  it.each([
    ["the close button", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
  ])("keeps unsent recipients when the dialog is closed with %s", (_label, close) => {
    openInvite();
    fireEvent.change(screen.getByRole("textbox", { name: "Email or phone for recipient 1" }), {
      target: { value: "dana.qa@example.com" },
    });
    close();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(screen.getByRole("textbox", { name: "Email or phone for recipient 1" })).toHaveValue(
      "dana.qa@example.com"
    );
  });

  it("explains on the row that text invitations are off", async () => {
    openInvite({ email: true, sms: false });
    const contact = screen.getByRole("textbox", { name: "Email or phone for recipient 1" });
    const user = userEvent.setup();
    await user.type(contact, "+1 555 000 0099");
    await user.tab();
    expect(contact).toHaveAccessibleDescription("Text invitations are turned off on this site.");
  });
});
