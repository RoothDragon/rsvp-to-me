import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "./render";
const { save, refresh } = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/locale", () => ({ setPreferredLocale: save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import GlobalError from "@/app/global-error";
describe("global-error fallback localization", () => {
  it("updates flag and error copy locally even when persistence is unavailable", async () => {
    save.mockRejectedValueOnce(new Error("root unavailable"));
    render(<GlobalError error={new Error("root failure")} reset={vi.fn()} />, {
      container: document as unknown as HTMLElement,
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nederlands" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Er ging iets mis" })).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: "Taal kiezen" }).querySelector("img")
    ).toHaveAttribute("src", "/flags/nl.svg");
    expect(screen.getByRole("button", { name: "Opnieuw laden" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
