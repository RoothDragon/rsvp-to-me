import React from "react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/components/render";
import DocsPanel, { type PanelDoc } from "@/components/docs/DocsPanel";
import dutch from "@/messages/nl-NL.json";

const docs: PanelDoc[] = [
  {
    slug: "starting",
    title: "Aan de slag",
    description: "Begin hier",
    category: "Handleidingen",
    content: "# Aan de slag {#getting-started}\n\n[Instellen](settings.md#settings)",
    locale: "nl-NL",
    dir: "ltr",
  },
  {
    slug: "settings",
    title: "Settings",
    description: "English fallback",
    category: "Guides",
    content: "# Settings\n\nEnglish article.",
    locale: "en-US",
    dir: "ltr",
  },
  {
    slug: "sharing",
    title: "Samen organiseren",
    description: "Samenwerken",
    category: "Handleidingen",
    content: "# Samen organiseren {#co-hosting}\n\n[Begin](starting.md#getting-started)",
    locale: "nl-NL",
    dir: "ltr",
  },
];

describe("DocsPanel language-aware navigation", () => {
  it("shows Dutch search feedback and filters translated article titles", async () => {
    const user = userEvent.setup();
    render(<DocsPanel docs={docs} />, { locale: "nl-NL", messages: dutch });
    expect(screen.getByRole("navigation", { name: "Hulpartikelen" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Handleidingen doorzoeken…" }), "Samen");
    expect(screen.getByRole("button", { name: "Samen organiseren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "niet-bestaand");
    expect(screen.getByText("Geen handleidingen gevonden.")).toBeInTheDocument();
  });

  it("navigates canonical crosslinks to translated and English fallback articles", async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    render(<DocsPanel docs={docs} />, { locale: "nl-NL", messages: dutch });
    expect(screen.getByRole("heading", { name: "Aan de slag" })).toHaveAttribute(
      "id",
      "getting-started"
    );
    await user.click(screen.getByRole("link", { name: "Instellen" }));
    expect(screen.getByRole("article")).toHaveAttribute("lang", "en-US");
    expect(screen.getByRole("heading", { name: "Settings" })).toHaveAttribute("id", "settings");
    await user.click(screen.getByRole("button", { name: "Samen organiseren" }));
    expect(screen.getByRole("article")).toHaveAttribute("lang", "nl-NL");
    await user.click(screen.getByRole("link", { name: "Begin" }));
    expect(screen.getByRole("heading", { name: "Aan de slag" })).toHaveAttribute(
      "id",
      "getting-started"
    );
    expect(screen.getByRole("article")).toHaveAttribute("dir", "ltr");
  });

  it("localizes the empty-article state through the real provider", () => {
    render(<DocsPanel docs={[]} />, { locale: "nl-NL", messages: dutch });
    expect(screen.getByText("Er zijn geen handleidingen beschikbaar.")).toBeInTheDocument();
  });
});
