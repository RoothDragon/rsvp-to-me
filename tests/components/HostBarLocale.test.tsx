import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import dutch from "@/messages/nl-NL.json";
import { testTheme } from "./helpers/theme";
const { sendBlast } = vi.hoisted(() => ({ sendBlast: vi.fn() }));
vi.mock("@/app/actions/event", () => ({
  sendBlast,
  sendSmsBlast: vi.fn(),
  saveEventSettings: vi.fn(),
  inviteGuest: vi.fn(),
}));
import { HostBar } from "@/components/event/HostBar";
describe("localized host messaging", () => {
  it.each([
    [2, "E-mail verzonden naar 2 gasten.", "rgb(74, 222, 128)"],
    [0, "Geen gasten met een e-mailadres gevonden.", "rgb(248, 113, 113)"],
  ])(
    "styles Dutch delivery feedback from the result for %i recipients",
    async (sent, message, color) => {
      sendBlast.mockResolvedValue({ success: true, sent });
      render(
        <HostBar
          eventId="event-1"
          eventSlug="party"
          theme={testTheme}
          visibility="PUBLIC"
          channelConfig={{ email: true, sms: false }}
        />,
        { locale: "nl-NL", messages: dutch }
      );
      expect(screen.getByRole("button", { name: "Openbaar" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Bericht sturen" }));
      fireEvent.change(screen.getByPlaceholderText("Typ je bericht…"), {
        target: { value: "Host-authored message stays verbatim" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Bericht versturen" }));
      await waitFor(() => expect(screen.getByText(message)).toBeVisible());
      expect(screen.getByText(message).style.color).toBe(color);
      expect(sendBlast).toHaveBeenCalledWith(
        "event-1",
        "Host-authored message stays verbatim",
        ["ALL"],
        null
      );
    }
  );
});
