
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/components/render";

const { mockRequestVerifiedGuestLink } = vi.hoisted(() => ({
  mockRequestVerifiedGuestLink: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  requestVerifiedGuestLinkAction: mockRequestVerifiedGuestLink,
}));

import { VerifiedRsvpGate } from "@/components/rsvp/VerifiedRsvpGate";

beforeEach(() => {
  mockRequestVerifiedGuestLink.mockReset();
});

describe("VerifiedRsvpGate", () => {
  it("requests a link for the selected RSVP status", async () => {
    mockRequestVerifiedGuestLink.mockResolvedValue({ success: true });

    render(
      <VerifiedRsvpGate eventSlug="test-party" status="MAYBE" />
    );

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "alice@example.com" },
    });

    fireEvent.click(screen.getByText("Send verification link"));

    await waitFor(() => {
      expect(mockRequestVerifiedGuestLink).toHaveBeenCalledWith(
        "alice@example.com",
        "test-party",
        "MAYBE",
        null
      );
    });

    expect(screen.getByText("Check your email")).toBeInTheDocument();
  });

  it("displays server errors without claiming an email was sent", async () => {
    mockRequestVerifiedGuestLink.mockResolvedValue({
      success: false,
      error: "Too many requests. Please try later.",
    });

    render(
      <VerifiedRsvpGate eventSlug="test-party" status="GOING" />
    );

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "alice@example.com" },
    });

    fireEvent.click(screen.getByText("Send verification link"));

    await waitFor(() => {
      expect(
        screen.getByText("Too many requests. Please try later.")
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });
});
