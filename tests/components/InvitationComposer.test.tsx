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
const channels = { email: true, sms: true };
function setup() {
  return render(<InvitationComposer eventId="event" channelConfig={channels} />);
}
function source() {
  return screen.getByLabelText("Invitation draft");
}
function fill(text: string) {
  fireEvent.change(source(), { target: { value: text } });
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
describe("InvitationComposer", () => {
  it("preserves ordinary name typing and focus, links source on commit, and undoes", async () => {
    setup();
    fill("alice@test.internal");
    const user = userEvent.setup();
    const name = screen.getByRole("textbox", { name: "Name (optional) 1" });
    await user.type(name, "Alice Smith");
    expect(name).toHaveValue("Alice Smith");
    expect(name).toHaveFocus();
    expect(screen.getByRole("button", { name: "Review invitations" })).toBeDisabled();
    await user.tab();
    expect(source()).toHaveValue('"Alice Smith" <alice@test.internal>');
    fireEvent.click(screen.getByRole("button", { name: "Select source text" }));
    expect(source()).toHaveFocus();
    expect((source() as HTMLTextAreaElement).selectionStart).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toHaveValue("alice@test.internal");
  });
  it("requires explicit repairs and duplicate resolution", () => {
    setup();
    fill("a@test.internal b@test.internal");
    expect(screen.getByRole("button", { name: "Review invitations" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply replacement" }));
    expect(source()).toHaveValue("a@test.internal, b@test.internal");
    fill("Alice <a@test.internal>, Bob <A@test.internal>");
    expect(screen.getByRole("button", { name: "Review invitations" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Keep occurrence 2/ }));
    expect(source()).toHaveValue(", Bob <A@test.internal>");
    expect(screen.getByRole("button", { name: "Review invitations" })).toBeEnabled();
  });
  it("requires explicit TSV mapping and can undo import", () => {
    setup();
    fill("old@test.internal");
    fireEvent.click(screen.getByRole("button", { name: "Import spreadsheet" }));
    fireEvent.change(screen.getByLabelText("Paste spreadsheet cells"), {
      target: { value: "Name\tEmail\nAlice\ta@test.internal" },
    });
    fireEvent.change(screen.getByLabelText("Column 1"), { target: { value: "name" } });
    fireEvent.change(screen.getByLabelText("Column 2"), { target: { value: "contact" } });
    fireEvent.click(screen.getByLabelText("First row is a header"));
    fireEvent.click(screen.getByRole("button", { name: "Import reviewed columns" }));
    expect(source()).toHaveValue('"Alice" <a@test.internal>');
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toHaveValue("old@test.internal");
    expect(screen.getByLabelText("First row is a header")).toBeChecked();
  });
  it("defaults only new recipients, preserves existing name and keeps partial failures", async () => {
    setup();
    fill("Alice <a@test.internal>, Bob <b@test.internal>");
    actions.previewGuestInvitations.mockResolvedValue({
      recipients: [
        newRow("a@test.internal", "Alice"),
        { ...newRow("b@test.internal", "Established"), disposition: "responded" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Review invitations" }));
    const existing = await screen.findByLabelText("b@test.internal — Responded");
    expect(existing).not.toBeChecked();
    expect(screen.getByLabelText("a@test.internal — New")).toBeChecked();
    expect(screen.getByText("Established")).toBeVisible();
    fireEvent.click(existing);
    actions.sendGuestInvitations.mockResolvedValue({
      success: false,
      results: [
        { contact: "a@test.internal", status: "sent" },
        { contact: "b@test.internal", status: "failed", error: "Delivery failed" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Send 2 invitations" }));
    await waitFor(() => expect(source()).toHaveValue(", Bob <b@test.internal>"));
    expect(screen.getByText(/Delivery failed/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Send 1 invitation" })).not.toBeInTheDocument();
    expect(actions.sendGuestInvitations.mock.calls[0][1][1]).toEqual({
      contact: "b@test.internal",
      name: "Bob",
      expectedDisposition: "responded",
      expectedGuestName: "Established",
    });
  });
  it("does not apply a stale event review", async () => {
    let resolve!: (value: unknown) => void;
    actions.previewGuestInvitations.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    setup();
    fill("a@test.internal");
    fireEvent.click(screen.getByRole("button", { name: "Review invitations" }));
    fill("b@test.internal");
    resolve({ recipients: [newRow("a@test.internal")] });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Send 1 invitation" })).not.toBeInTheDocument()
    );
  });
  it("sandboxes personalized HTML and keeps a thrown send failure visible", async () => {
    setup();
    fill("Alice <a@test.internal>");
    actions.previewGuestInvitations.mockResolvedValue({
      recipients: [newRow("a@test.internal", "Alice")],
    });
    fireEvent.click(screen.getByRole("button", { name: "Review invitations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Personalized preview" }));
    const frame = await screen.findByTitle("Personalized preview");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(actions.getEventEmailPreview).toHaveBeenCalledWith("event", "invite", "Alice");
    actions.sendGuestInvitations.mockRejectedValue(new Error("Network unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Send 1 invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  });
  it("rejects a review returned for a different event", async () => {
    let resolve!: (value: unknown) => void;
    actions.previewGuestInvitations.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    const view = setup();
    fill("a@test.internal");
    fireEvent.click(screen.getByRole("button", { name: "Review invitations" }));
    view.rerender(<InvitationComposer eventId="another-event" channelConfig={channels} />);
    resolve({ recipients: [newRow("a@test.internal")] });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Send 1 invitation" })).not.toBeInTheDocument()
    );
  });
  it("discards personalized previews after source changes", async () => {
    let resolve!: (value: unknown) => void;
    actions.getEventEmailPreview.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    setup();
    fill("Alice <a@test.internal>");
    actions.previewGuestInvitations.mockResolvedValue({
      recipients: [newRow("a@test.internal", "Alice")],
    });
    fireEvent.click(screen.getByRole("button", { name: "Review invitations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Personalized preview" }));
    fill("Bob <b@test.internal>");
    resolve({ subject: "Old subject", html: "<p>Old private preview</p>" });
    await waitFor(() =>
      expect(screen.queryByTitle("Personalized preview")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Old subject")).not.toBeInTheDocument();
  });
  it("shows actionable parser and spreadsheet locations instead of internal issue codes", () => {
    setup();
    fill("Invalid <bad-contact>");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address or phone number."
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("invalidContact");
    fireEvent.click(screen.getByRole("button", { name: "Import spreadsheet" }));
    fireEvent.change(screen.getByLabelText("Paste spreadsheet cells"), {
      target: { value: "Alice\tinvalid" },
    });
    fireEvent.change(screen.getByLabelText("Column 1"), { target: { value: "name" } });
    fireEvent.change(screen.getByLabelText("Column 2"), { target: { value: "contact" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Row 1 Column 2: Enter a valid email address or phone number."
    );
  });
  it("resynchronizes dirty same-length row buffers from source and undo", async () => {
    setup();
    fill('"Alice" <alice@test.internal>');
    const user = userEvent.setup();
    let name = screen.getByRole("textbox", { name: "Name (optional) 1" });
    await user.clear(name);
    await user.type(name, "Carol");
    await user.tab();
    expect(source()).toHaveValue('"Carol" <alice@test.internal>');
    fill('"David" <david@test.internal>');
    name = screen.getByRole("textbox", { name: "Name (optional) 1" });
    expect(name).toHaveValue("David");
    expect(screen.getByRole("textbox", { name: "Email or phone 1" })).toHaveValue(
      "david@test.internal"
    );
    await user.click(name);
    await user.tab();
    expect(source()).toHaveValue('"David" <david@test.internal>');
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toHaveValue('"Carol" <alice@test.internal>');
    expect(screen.getByRole("textbox", { name: "Name (optional) 1" })).toHaveValue("Carol");
    let contact = screen.getByRole("textbox", { name: "Email or phone 1" });
    await user.clear(contact);
    await user.type(contact, "carol@test.internal");
    await user.tab();
    fill('"Carol" <david@test.internal>');
    contact = screen.getByRole("textbox", { name: "Email or phone 1" });
    expect(contact).toHaveValue("david@test.internal");
    await user.click(contact);
    await user.tab();
    expect(source()).toHaveValue('"Carol" <david@test.internal>');
  });
});
