// 01a18e04: the collapsed description stripped formatting and hid content after
// only 360 characters. Both views must retain safe, balanced HTML with a larger preview.
import { describe, expect, it } from "vitest";
import { eventDescriptionPreview, sanitizeEventDescription } from "@/lib/event-description";

describe("formatted description preview", () => {
  it("shows 1,200 characters, balances nested markup, and excludes later links", () => {
    const value = `<ul><li><strong>${"x".repeat(1201)}</strong></li></ul><a href="/later">Hidden</a>`;
    const preview = eventDescriptionPreview(value);
    expect(preview.truncated).toBe(true);
    expect(preview.html).toBe(`<ul><li><strong>${"x".repeat(1200)}</strong></li></ul>`);
    expect(sanitizeEventDescription(preview.html)).toBe(preview.html);
  });
  it("does not collapse a description at exactly the character limit", () => {
    expect(eventDescriptionPreview(`<p>${"x".repeat(1200)}</p>`)).toEqual({
      html: `<p>${"x".repeat(1200)}</p>`,
      truncated: false,
    });
  });
  it("counts entities and Unicode code points as complete visible characters", () => {
    const preview = eventDescriptionPreview(`<p>${"x".repeat(1198)}&amp;🎉extra</p>`);
    expect(preview.html).toBe(`<p>${"x".repeat(1198)}&amp;🎉</p>`);
    expect(preview.truncated).toBe(true);
  });
  it.each([
    ["plain", "Line\n".repeat(16) + "Hidden"],
    ["paragraphs", "<p>Line</p>".repeat(16) + "<p>Hidden</p>"],
    ["list", "<ul>" + "<li>Line</li>".repeat(16) + "<li>Hidden</li></ul>"],
    ["breaks", "Line<br>".repeat(16) + "Hidden"],
  ])("limits %s to 16 logical lines", (_kind, value) => {
    const preview = eventDescriptionPreview(value);
    expect(preview.truncated).toBe(true);
    expect(preview.html).not.toContain("Hidden");
    expect(sanitizeEventDescription(preview.html)).toBe(preview.html);
  });
  it("keeps short formatting, rules, links, and quoted attribute delimiters", () => {
    const value =
      '<h2>Agenda</h2><ul><li><b>Food</b></li></ul><hr><a href="/help" title="a > b">Help</a>';
    const preview = eventDescriptionPreview(value);
    expect(preview).toEqual({ html: sanitizeEventDescription(value), truncated: false });
  });
  it("sanitizes legacy active content before truncating", () => {
    const preview = eventDescriptionPreview(
      `<script>bad()</script><p onclick="bad()">${"x".repeat(1300)}</p><img src=x onerror=bad()>`
    );
    expect(preview.html).toBe(`<p>${"x".repeat(1200)}</p>`);
  });
  it("does not leave an empty clipped anchor in the tab order", () => {
    const preview = eventDescriptionPreview(
      `<p>${"x".repeat(1199)}<a href="/empty"></a>x<a href="/later">Later</a></p>`
    );
    expect(preview.html).not.toContain("<a");
  });
});
