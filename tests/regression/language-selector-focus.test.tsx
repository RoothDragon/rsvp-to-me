// @vitest-environment jsdom
// Root cause (2026-10-19): every mounted language selector handled document Escape
// even with its menu closed. Closed controls stole focus from inputs, and the
// profile's second selector could steal focus from the selector whose menu closed.
// The profile selector was later removed (459b19e2); two mounted instances stay covered.
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@/tests/components/render";
vi.mock("@/app/actions/locale", () => ({ setPreferredLocale: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import LanguageSelector from "@/components/ui/LanguageSelector";

describe("language selector Escape focus ownership", () => {
  it("preserves unrelated input focus while its menu is closed", () => {
    render(
      <>
        <input aria-label="Profile name" />
        <LanguageSelector />
      </>
    );
    const input = screen.getByRole("textbox", { name: "Profile name" });
    input.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(input).toHaveFocus();
  });
  it.each([0, 1])("returns focus only to open selector %s when two are mounted", (index) => {
    render(
      <>
        <LanguageSelector />
        <LanguageSelector />
      </>
    );
    const triggers = screen.getAllByRole("button", { name: "Choose language" });
    fireEvent.click(triggers[index]);
    const firstChoice = screen.getByRole("menuitemradio", { name: "English (US)" });
    firstChoice.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(triggers[index]).toHaveFocus();
  });
});
