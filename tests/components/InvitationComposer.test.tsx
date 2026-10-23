import { useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import userEvent from "@testing-library/user-event";
const actions = vi.hoisted(() => ({
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
  getEventEmailPreview: vi.fn(),
}));
vi.mock("@/app/actions/event", () => actions);
import { InvitationComposer } from "@/components/event/InvitationComposer";
import { emptyInvitationDraft, invitationDraftReducer } from "@/lib/invitation-draft-rows";

const channels = { email: true, sms: true };

/** Owns the draft like HostBar does. */
function Harness({
  eventId = "event",
  channelConfig = channels,
}: {
  eventId?: string;
  channelConfig?: { email: boolean; sms: boolean };
}) {
  const [draft, dispatch] = useReducer(invitationDraftReducer, emptyInvitationDraft);
  return (
    <InvitationComposer
      eventId={eventId}
      channelConfig={channelConfig}
      draft={draft}
      dispatch={dispatch}
    />
  );
}

const nameField = (n: number) => screen.getByRole("textbox", { name: `Name for recipient ${n}` });
const contactField = (n: number) =>
  screen.getByRole("textbox", { name: `Email or phone for recipient ${n}` });
const reviewButton = () => screen.getByRole("button", { name: /^Review \d+ invitations?$/ });
function paste(element: HTMLElement, text: string) {
  fireEvent.paste(element, { clipboardData: { getData: () => text } });
}
const newRow = (contact: string, guestName = "Guest") => ({
  contact,
  guestName,
  disposition: "new",
  channel: "EMAIL",
});

beforeEach(() => {
  vi.clearAllMocks();
  actions.getEventEmailPreview.mockResolvedValue({ subject: "Hello Alice", html: "<p>Hello</p>" });
});

describe("InvitationComposer — adding recipients", () => {
  it("types recipients row by row, moving with Enter, and counts what will be sent", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.type(nameField(1), "Alice Smith{Enter}");
    expect(contactField(1)).toHaveFocus();
    await user.type(contactField(1), "alice@test.internal{Enter}");
    expect(nameField(2)).toHaveFocus();
    await user.type(contactField(2), "555-123-4567");
    expect(screen.getByText("Email")).toBeVisible();
    expect(screen.getByText("Text message")).toBeVisible();
    expect(reviewButton()).toHaveTextContent("Review 2 invitations");
    expect(screen.getByText(/1 without a name/)).toBeVisible();
  });

  it("turns a pasted list into rows, flags problems in place, and blocks review until fixed", async () => {
    render(<Harness />);
    paste(nameField(1), "Alice <a@test.internal>\nBob <not-valid>; Smith, Carol <c@test.internal>");
    expect(nameField(1)).toHaveValue("Alice");
    expect(nameField(2)).toHaveValue("Bob");
    expect(contactField(3)).toHaveValue("c@test.internal");
    expect(nameField(3)).toHaveValue("Smith, Carol");
    expect(screen.getByRole("status")).toHaveTextContent("Added 3 recipients.");
    expect(contactField(2)).toHaveAccessibleDescription(
      "Check this email address or phone number."
    );
    expect(reviewButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "1 needs attention" }));
    expect(contactField(2)).toHaveFocus();
    const user = userEvent.setup();
    await user.clear(contactField(2));
    await user.type(contactField(2), "b@test.internal");
    expect(reviewButton()).toBeEnabled();
  });

  it("skips exact repeats and flags the same contact under another name", () => {
    render(<Harness />);
    paste(nameField(1), "Ann <ann@test.internal>, ann@test.internal");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added 1 recipient. Skipped 1 already in the list."
    );
    paste(nameField(2), "Annie <ANN@test.internal>, Ben <b@test.internal>");
    expect(contactField(2)).toHaveAccessibleDescription(
      "Same contact as recipient 1. Remove one of them."
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove recipient 2" }));
    expect(nameField(2)).toHaveValue("Ben");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(nameField(2)).toHaveValue("Annie");
  });

  it("opens the spreadsheet import pre-mapped when cells are pasted", () => {
    render(<Harness />);
    paste(
      contactField(1),
      "Name\tEmail\tNotes\nAlice\ta@test.internal\tvip\nBob\tb@test.internal\t"
    );
    expect(screen.getByLabelText("First row has column names")).toBeChecked();
    expect(screen.getByLabelText("Name from")).toHaveDisplayValue("Name (e.g. Alice)");
    expect(screen.getByLabelText("Email or phone from")).toHaveDisplayValue(
      "Email (e.g. a@test.internal)"
    );
    fireEvent.click(screen.getByRole("button", { name: "Add 2 recipients" }));
    expect(nameField(1)).toHaveValue("Alice");
    expect(contactField(2)).toHaveValue("b@test.internal");
  });

  it("explains a disabled channel on the row instead of at review", () => {
    render(<Harness channelConfig={{ email: true, sms: false }} />);
    paste(nameField(1), "Dee 555-123-4567\nEve eve@test.internal");
    expect(contactField(1)).toHaveAccessibleDescription(
      "Text invitations are turned off on this site."
    );
    expect(reviewButton()).toBeDisabled();
  });
});

describe("InvitationComposer — review and send", () => {
  it("defaults only new recipients, preserves existing names and keeps partial failures", async () => {
    render(<Harness />);
    paste(nameField(1), "Alice <a@test.internal>, Bob <b@test.internal>");
    actions.previewGuestInvitations.mockResolvedValue({
      recipients: [
        newRow("a@test.internal", "Alice"),
        { ...newRow("b@test.internal", "Established"), disposition: "responded" },
      ],
    });
    fireEvent.click(reviewButton());
    expect(actions.previewGuestInvitations).toHaveBeenCalledWith("event", [
      { contact: "a@test.internal", name: "Alice" },
      { contact: "b@test.internal", name: "Bob" },
    ]);
    const existing = await screen.findByRole("checkbox", { name: /b@test\.internal/ });
    expect(existing).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /a@test\.internal/ })).toBeChecked();
    expect(screen.getByText(/Greeted as Established · Keeps the name/)).toBeVisible();
    fireEvent.click(existing);
    actions.sendGuestInvitations.mockResolvedValue({
      success: false,
      results: [
        { contact: "a@test.internal", status: "sent" },
        { contact: "b@test.internal", status: "failed", error: "Delivery failed" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Send 2 invitations" }));
    expect(await screen.findByText("1 invitation sent.")).toBeVisible();
    expect(screen.getByText(/Delivery failed/)).toBeVisible();
    expect(actions.sendGuestInvitations.mock.calls[0][1][1]).toEqual({
      contact: "b@test.internal",
      name: "Bob",
      expectedDisposition: "responded",
      expectedGuestName: "Established",
    });
    fireEvent.click(screen.getByRole("button", { name: "Back to recipients" }));
    expect(contactField(1)).toHaveValue("b@test.internal");
    expect(screen.queryByDisplayValue("a@test.internal")).not.toBeInTheDocument();
  });

  it("removes delivered rows even when the dialog closed while sending", async () => {
    let resolve!: (value: unknown) => void;
    actions.sendGuestInvitations.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    actions.previewGuestInvitations.mockResolvedValue({
      recipients: [newRow("a@test.internal"), newRow("b@test.internal")],
    });
    function Closable({ open }: { open: boolean }) {
      const [draft, dispatch] = useReducer(invitationDraftReducer, emptyInvitationDraft);
      return open ? (
        <InvitationComposer
          eventId="event"
          channelConfig={channels}
          draft={draft}
          dispatch={dispatch}
        />
      ) : null;
    }
    const view = render(<Closable open />);
    paste(nameField(1), "a@test.internal, b@test.internal");
    fireEvent.click(reviewButton());
    fireEvent.click(await screen.findByRole("button", { name: "Send 2 invitations" }));
    await waitFor(() => expect(actions.sendGuestInvitations).toHaveBeenCalled());
    view.rerender(<Closable open={false} />);
    resolve({
      success: true,
      results: [
        { contact: "a@test.internal", status: "sent" },
        { contact: "b@test.internal", status: "failed", error: "Delivery failed" },
      ],
    });
    await new Promise((r) => setTimeout(r, 0));
    view.rerender(<Closable open />);
    expect(contactField(1)).toHaveValue("b@test.internal");
    expect(screen.queryByDisplayValue("a@test.internal")).not.toBeInTheDocument();
  });

  it("drops a review that resolves after the host went back to edit", async () => {
    let resolve!: (value: unknown) => void;
    actions.previewGuestInvitations.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    render(<Harness />);
    paste(nameField(1), "a@test.internal, b@test.internal");
    fireEvent.click(reviewButton());
    fireEvent.click(screen.getByRole("button", { name: "← Edit recipients" }));
    resolve({ recipients: [newRow("a@test.internal"), newRow("b@test.internal")] });
    await waitFor(() => expect(nameField(1)).toBeVisible());
    expect(screen.queryByRole("button", { name: /^Send/ })).not.toBeInTheDocument();
  });

  it("rejects a review returned for a different event", async () => {
    let resolve!: (value: unknown) => void;
    actions.previewGuestInvitations.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    function Switcher({ eventId }: { eventId: string }) {
      const [draft, dispatch] = useReducer(invitationDraftReducer, emptyInvitationDraft);
      return (
        <InvitationComposer
          eventId={eventId}
          channelConfig={channels}
          draft={draft}
          dispatch={dispatch}
        />
      );
    }
    const view = render(<Switcher eventId="event" />);
    paste(nameField(1), "a@test.internal, b@test.internal");
    fireEvent.click(reviewButton());
    view.rerender(<Switcher eventId="another-event" />);
    resolve({ recipients: [newRow("a@test.internal"), newRow("b@test.internal")] });
    await waitFor(() => expect(nameField(1)).toBeVisible());
    expect(screen.queryByRole("button", { name: /^Send/ })).not.toBeInTheDocument();
  });

  it("sandboxes personalized HTML and keeps a thrown send failure visible", async () => {
    render(<Harness />);
    paste(nameField(1), "Alice <a@test.internal>, b@test.internal");
    actions.previewGuestInvitations.mockResolvedValue({
      recipients: [newRow("a@test.internal", "Alice"), newRow("b@test.internal")],
    });
    fireEvent.click(reviewButton());
    fireEvent.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    const frame = await screen.findByTitle("Invitation preview for Alice");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(actions.getEventEmailPreview).toHaveBeenCalledWith("event", "invite", "Alice");
    actions.sendGuestInvitations.mockRejectedValue(new Error("Network unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Send 2 invitations" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(nameField(1)).toHaveValue("Alice");
  });

  it("discards a personalized preview that resolves after leaving the review", async () => {
    let resolve!: (value: unknown) => void;
    actions.getEventEmailPreview.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    render(<Harness />);
    paste(nameField(1), "Alice <a@test.internal>, b@test.internal");
    actions.previewGuestInvitations.mockResolvedValue({
      recipients: [newRow("a@test.internal", "Alice"), newRow("b@test.internal")],
    });
    fireEvent.click(reviewButton());
    fireEvent.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "← Edit recipients" }));
    resolve({ subject: "Old subject", html: "<p>Old private preview</p>" });
    await waitFor(() => expect(nameField(1)).toBeVisible());
    expect(screen.queryByText(/Old subject/)).not.toBeInTheDocument();
    expect(screen.queryByTitle("Invitation preview for Alice")).not.toBeInTheDocument();
  });
});
