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
//
// Follow-up (de78391d, QC of #755): only bulk adds checked the 200-recipient
// batch cap, so typing into the trailing blank row after a 200-person import
// offered a 201-person review the server always rejects. Typing a new recipient
// into a full batch is now refused with the same status-line feedback.
//
// Follow-up (de78391d, QC of #755): imports moved names onto the wrong guest or
// dropped one. Any letter-bearing first row was guessed to be a header, so an
// invalid first guest vanished; and in `a@x, Alice, b@y, Bob` each name was
// attached to the following contact. Headers are now guessed only from known
// column labels, contact-first lists pair each name with its own contact, and a
// name that could belong to either neighbour stays its own row to fix.
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

  it("keeps each pasted name with its own contact in a contact-first list", () => {
    openInvite();
    fireEvent.paste(screen.getByRole("textbox", { name: "Name for recipient 1" }), {
      clipboardData: { getData: () => "alice@example.com, Alice, bob@example.com, Bob" },
    });
    expect(screen.getByRole("textbox", { name: "Name for recipient 1" })).toHaveValue("Alice");
    expect(screen.getByRole("textbox", { name: "Email or phone for recipient 1" })).toHaveValue(
      "alice@example.com"
    );
    expect(screen.getByRole("textbox", { name: "Name for recipient 2" })).toHaveValue("Bob");
  });

  it("imports an invalid first spreadsheet row as a recipient to fix", () => {
    openInvite();
    fireEvent.paste(screen.getByRole("textbox", { name: "Name for recipient 1" }), {
      clipboardData: { getData: () => "Alice\tnot-an-address\nBob\tbob@example.com" },
    });
    expect(screen.getByLabelText("First row has column names")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Add 2 recipients" }));
    expect(screen.getByRole("textbox", { name: "Name for recipient 1" })).toHaveValue("Alice");
    expect(screen.getByRole("textbox", { name: "Email or phone for recipient 1" })).toHaveValue(
      "not-an-address"
    );
    expect(screen.getByRole("textbox", { name: "Name for recipient 2" })).toHaveValue("Bob");
  });

  it("refuses typing a 201st recipient after a full import", () => {
    openInvite();
    const list = Array.from({ length: 200 }, (_, i) => `guest${i}@example.com`).join("\n");
    fireEvent.paste(screen.getByRole("textbox", { name: "Name for recipient 1" }), {
      clipboardData: { getData: () => list },
    });
    const next = screen.getByRole("textbox", { name: "Name for recipient 201" });
    fireEvent.change(next, { target: { value: "Late Guest" } });

    expect(next).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "This batch already has 200 people. Review and send it, then add more."
    );
    expect(screen.getByRole("button", { name: "Review 200 invitations" })).toBeEnabled();
  });
});
