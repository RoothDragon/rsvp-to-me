import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/tests/components/render";
import { testTheme } from "./helpers/theme";
vi.mock("@/app/actions/event", () => ({
  sendBlast: vi.fn(),
  sendSmsBlast: vi.fn(),
  saveEventSettings: vi.fn(),
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
  getEventEmailPreview: vi.fn(),
}));
import { HostBar } from "@/components/event/HostBar";

function renderHostBar(channelConfig = { email: true, sms: true }) {
  return render(
    <HostBar
      eventId="event-1"
      eventSlug="party"
      theme={testTheme}
      visibility="PUBLIC"
      channelConfig={channelConfig}
    />
  );
}

describe("HostBar invite dialog", () => {
  it("opens on Invite people with the first name field focused", () => {
    renderHostBar();
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(screen.getByRole("tab", { name: "Invite people" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("textbox", { name: "Name for recipient 1" })).toHaveFocus();
  });

  it("switches tabs with the arrow keys and shows the share link", () => {
    renderHostBar();
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "Invite people" }), { key: "ArrowRight" });
    const share = screen.getByRole("tab", { name: "Share link" });
    expect(share).toHaveAttribute("aria-selected", "true");
    expect(share).toHaveFocus();
    expect(screen.getByRole("button", { name: "Copy Link" })).toBeVisible();
  });

  it("starts on Share link when messaging is not configured", () => {
    renderHostBar({ email: false, sms: false });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(screen.getByRole("tab", { name: "Share link" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
