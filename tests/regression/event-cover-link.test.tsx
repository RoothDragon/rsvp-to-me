// @vitest-environment jsdom
// 01a18e04: the cover was only a cropped image, with no keyboard-accessible way
// to open its full upload. Linking must also reject executable legacy URLs.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@/tests/components/render";
import { EventCoverImage } from "@/components/event/event-page/EventCoverImage";
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
afterEach(cleanup);
describe("cover image navigation", () => {
  it.each(["/api/uploads/cover.jpg", "https://example.com/cover.jpg"])(
    "links the original %s in a safe new tab",
    (url) => {
      render(<EventCoverImage url={url} alt="Party cover" label="Open full cover (new tab)" />);
      const link = screen.getByRole("link", { name: "Open full cover (new tab)" });
      expect(link.getAttribute("href")).toBe(url);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.contains(screen.getByRole("img", { name: "Party cover" }))).toBe(true);
    }
  );
  it.each(["javascript:alert(1)", "data:text/html,bad", "vbscript:bad", " java\nscript:bad"])(
    "does not link executable legacy URL %s",
    (url) => {
      render(<EventCoverImage url={url} alt="Cover" label="Open cover" />);
      expect(screen.queryByRole("link")).toBeNull();
    }
  );
});
