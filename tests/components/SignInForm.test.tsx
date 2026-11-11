import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@/tests/components/render";
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({ sendMagicLinkAction: send }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
import SignInForm from "@/app/auth/sign-in/SignInForm";
beforeEach(() => send.mockReset());
it("offers the same continuation and confirmation for a new email", async () => {
  send.mockResolvedValue({ success: true });
  render(<SignInForm openRegistration={false} />);
  expect(screen.getByRole("heading", { name: "Continue with email" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "new@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));
  expect(
    await screen.findByText("Check your email for a secure link to continue.")
  ).toBeInTheDocument();
  expect(send).toHaveBeenCalledWith("new@example.com", undefined, null);
});
it("does not show a sent confirmation when delivery fails", async () => {
  send.mockResolvedValue({ success: false, error: "auth_failed" });
  render(<SignInForm openRegistration={false} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "new@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));
  expect(await screen.findByText("Sign-in failed")).toBeInTheDocument();
  expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
});
