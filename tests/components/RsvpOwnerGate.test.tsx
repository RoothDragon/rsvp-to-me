import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/components/render";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({ requestRsvpOwnerLinkAction: request }));
import { RsvpOwnerGate } from "@/components/rsvp/RsvpOwnerGate";
beforeEach(() => {
  request.mockReset();
});
it("requests verification for the current token and status without asking for a new contact", async () => {
  request.mockResolvedValue({ success: true });
  render(<RsvpOwnerGate editToken="invite-token" status="MAYBE" />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Send sign-in link"));
  await waitFor(() => expect(request).toHaveBeenCalledWith("invite-token", "MAYBE", null));
  expect(await screen.findByText("Check your email or phone")).toBeInTheDocument();
});
it("shows delivery errors and permits retry", async () => {
  request.mockResolvedValue({ success: false, error: "Please contact the host." });
  render(<RsvpOwnerGate editToken="invite-token" status="GOING" />);
  fireEvent.click(screen.getByText("Send sign-in link"));
  expect(await screen.findByText("Please contact the host.")).toBeInTheDocument();
  expect(screen.getByText("Send sign-in link")).toBeEnabled();
  expect(screen.queryByText("Check your email or phone")).not.toBeInTheDocument();
});
