// @vitest-environment jsdom
// 01a18e04: vertical-only controls prevented width resizing; full descriptions
// overwhelmed event pages. Exercise real editor/collapse/preview interactions.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@/tests/components/render";
import { DescriptionEditor } from "@/components/event/DescriptionEditor";
import { EventDescription } from "@/components/event/event-page/EventDescription";

afterEach(cleanup);

describe("event description controls", () => {
  it("resizes in both directions and retains form data while previewing safely", () => {
    const submit = vi.fn();
    render(
      <form onSubmit={submit}>
        <DescriptionEditor name="description" />
      </form>
    );
    const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(editor.style.resize).toBe("both");
    fireEvent.change(editor, { target: { value: "<h2>Agenda</h2><img src=x onerror=alert(1)>" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(new FormData(document.querySelector("form")!).get("description")).toContain(
      "<h2>Agenda</h2>"
    );
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit text" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("<h2>Agenda</h2>");
  });

  it("preserves rich formatting in both views and omits content beyond the cutoff", () => {
    const value = `<h2>Agenda</h2><ul><li><strong>Bring snacks</strong></li></ul><hr><a href="/help">Read this first</a><p>${"Welcome to the party. ".repeat(90)}</p><h2>Final section</h2><a href="https://example.com">Full details</a>`;
    render(<EventDescription value={value} isHost={false} onSave={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Show more" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeTruthy();
    expect(screen.getByText("Bring snacks").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "Read this first" }).getAttribute("href")).toBe(
      "/help"
    );
    expect(screen.queryByRole("link", { name: "Full details" })).toBeNull();
    expect(screen.queryByText("Final section")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole("heading", { name: "Final section" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Full details" })).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeTruthy();
    expect(screen.getByText("Bring snacks").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "Read this first" }).getAttribute("href")).toBe(
      "/help"
    );
    expect(screen.queryByRole("link", { name: "Full details" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit description" })).toBeNull();
  });

  it("collapses descriptions with many short lines and displays short descriptions fully", () => {
    const { rerender } = render(
      <EventDescription value={"Line\n".repeat(18)} isHost={false} onSave={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Show more" })).toBeTruthy();
    rerender(<EventDescription value="<strong>Short</strong>" isHost={false} onSave={vi.fn()} />);
    expect(screen.getByText("Short").tagName).toBe("STRONG");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("edits even a collapsed description and saves only through an explicit button", () => {
    const onSave = vi.fn();
    render(<EventDescription value={"Long description. ".repeat(100)} isHost onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));
    const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(editor.style.resize).toBe("both");
    fireEvent.change(editor, { target: { value: "<p>Updated</p>" } });
    fireEvent.blur(editor);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith("<p>Updated</p>");
  });

  it("cancels changes and reopens with the latest saved value", () => {
    const onSave = vi.fn();
    render(<EventDescription value="Original" isHost onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Original");
    expect(onSave).not.toHaveBeenCalled();
  });
  it("shows a medium formatted description fully with the larger default", () => {
    render(
      <EventDescription
        value={`<h2>Schedule</h2><p>${"More details. ".repeat(60)}</p>`}
        isHost={false}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Schedule" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
