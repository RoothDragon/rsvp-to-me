import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "./render";
import dutch from "@/messages/nl-NL.json";
const { save, refresh } = vi.hoisted(() => ({ path: "/", save: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/locale", () => ({ setPreferredLocale: save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/" }));
import LanguageSelector from "@/components/ui/LanguageSelector";
import GlobalHeader from "@/components/ui/GlobalHeader";
describe("language selector", () => {
  beforeEach(() => vi.clearAllMocks());
  it("shows a language icon with the current code and persists a menu selection", async () => {
    render(<LanguageSelector />);
    const trigger = screen.getByRole("button", { name: "Choose language" });
    expect(trigger).toHaveTextContent("EN");
    expect(trigger.querySelector("svg")).not.toBeNull();
    expect(trigger.querySelector("img")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "English (US)" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nederlands" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("nl-NL"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("closes on Escape and returns trigger focus", () => {
    render(<LanguageSelector />);
    const trigger = screen.getByRole("button", { name: "Choose language" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("offers the German flag and native name and saves the selection", async () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    const german = screen.getByRole("menuitemradio", { name: "Deutsch" });
    expect(german.querySelector("img")).toHaveAttribute("src", "/flags/de.svg");
    fireEvent.click(german);
    await waitFor(() => expect(save).toHaveBeenCalledWith("de-DE"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("offers the Spanish flag and native name and saves the selection", async () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    const spanish = screen.getByRole("menuitemradio", { name: "Español" });
    expect(spanish.querySelector("img")).toHaveAttribute("src", "/flags/es.svg");
    fireEvent.click(spanish);
    await waitFor(() => expect(save).toHaveBeenCalledWith("es-ES"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("closes on outside pointer", () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("keeps typed client state during language refresh", async () => {
    render(
      <>
        <input aria-label="Draft" defaultValue="" />
        <LanguageSelector />
      </>
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), {
      target: { value: "Unsent words" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nederlands" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Unsent words");
  });
  it("supports keyboard menu navigation", async () => {
    render(<LanguageSelector />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Choose language" }), {
      key: "ArrowDown",
    });
    await waitFor(() =>
      expect(screen.getByRole("menuitemradio", { name: "English (US)" })).toHaveFocus()
    );
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitemradio", { name: "Deutsch" })).toHaveFocus();
  });
  it("lists English first, then the other languages alphabetically by native name", () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    expect(screen.getAllByRole("menuitemradio").map((item) => item.getAttribute("lang"))).toEqual([
      "en-US",
      "de-DE",
      "es-ES",
      "nl-NL",
    ]);
  });
  it("uses compact menu rows with circular local flags", () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    const english = screen.getByRole("menuitemradio", { name: "English (US)" });
    expect(english.querySelector("img")).toHaveAttribute("src", "/flags/us.svg");
    expect(english.querySelector("img")).toHaveAttribute("width", "28");
    expect(english).toHaveStyle({ padding: "6px 8px", fontSize: "15px" });
  });
  it("scrolls a long menu to the current language when it opens", () => {
    const layout = [
      vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
        this: HTMLElement
      ) {
        return this.getAttribute("aria-checked") === "true" ? 400 : 0;
      }),
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40),
      vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(200),
    ];
    const scrollTop = vi.spyOn(Element.prototype, "scrollTop", "set");
    try {
      render(<LanguageSelector />, { locale: "nl-NL", messages: dutch });
      fireEvent.click(screen.getByRole("button", { name: "Taal kiezen" }));
      expect(scrollTop).toHaveBeenCalledWith(320);
    } finally {
      [...layout, scrollTop].forEach((spy) => spy.mockRestore());
    }
  });
  it("shows a recoverable error without refreshing on failed save", async () => {
    save.mockRejectedValueOnce(new Error("offline"));
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nederlands" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not save language")
    );
    expect(refresh).not.toHaveBeenCalled();
  });
  it("pins the header layout to physical left/right under RTL", () => {
    render(
      <div dir="rtl">
        <GlobalHeader user={null} />
      </div>
    );
    expect(screen.getByRole("navigation")).toHaveStyle({ direction: "ltr" });
  });
  it("places flag immediately before profile in one global navigation", () => {
    render(<GlobalHeader user={null} />);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    const language = screen.getByRole("button", { name: "Choose language" });
    const profile = screen.getByRole("button", { name: "Open menu" });
    expect(
      language.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
