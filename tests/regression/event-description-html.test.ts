// 01a18e04, November 2026: descriptions were plain text everywhere. Adding HTML
// without a shared allowlist would enable stored XSS and leak tags into calendars.
import { describe, expect, it } from "vitest";
import { eventDescriptionText, sanitizeEventDescription } from "@/lib/event-description";
import { buildGoogleCalendarUrl, buildIcsContent } from "@/lib/calendar";
import { buildEventSocialMetadata, type SocialEvent } from "@/lib/event-social";

describe("event description HTML boundary", () => {
  it("retains supported formatting and ordinary links", () => {
    const html =
      '<h2>Schedule</h2><p><strong>Bring</strong> <em>food</em></p><ul><li>Lunch</li></ul><ol><li>Dance</li></ol><hr><a href="https://example.com" title="Details">Details</a>';
    const safe = sanitizeEventDescription(html);
    expect(safe).toContain("<h2>Schedule</h2>");
    expect(safe).toContain("<ul><li>Lunch</li></ul>");
    expect(safe).toContain("<ol><li>Dance</li></ol>");
    expect(safe).toContain('<a href="https://example.com" title="Details">');
    expect(sanitizeEventDescription(safe)).toBe(safe);
  });

  it.each([
    "<script>alert(1)</script><p>Safe</p>",
    '<p onclick="alert(1)" style="position:fixed">Safe</p>',
    '<img src="https://tracker.example/image" onerror="alert(1)"><p>Safe</p>',
    '<iframe src="https://example.com">bad</iframe><p>Safe</p>',
    '<svg><a href="javascript:alert(1)">bad</a></svg><p>Safe</p>',
    "<math><mtext>bad</mtext></math><p>Safe</p>",
    "<style>body {display:none}</style><p>Safe</p>",
    '<object data="data:text/html,bad">bad</object><p>Safe</p>',
    "<template><p>bad</p></template><p>Safe</p>",
  ])("removes active content, media, and attributes: %s", (html) => {
    expect(sanitizeEventDescription(html)).toBe("<p>Safe</p>");
  });

  it.each([
    "javascript:alert(1)",
    "jav&#x61;script:alert(1)",
    "java&#10;script:alert(1)",
    "data:text/html,bad",
    "//tracker.example/x",
    "vbscript:bad",
  ])("removes unsafe link URL %s", (href) => {
    expect(sanitizeEventDescription(`<a href="${href}" target="_blank">Details</a>`)).toBe(
      "<a>Details</a>"
    );
  });

  it("keeps relative web links and repairs malformed markup", () => {
    expect(sanitizeEventDescription('<ul><li>One<li>Two</ul><a href="/help">Help</a>')).toBe(
      '<ul><li>One</li><li>Two</li></ul><a href="/help">Help</a>'
    );
  });

  it("preserves legacy plain text, entities, and line breaks", () => {
    const text = "Meet & greet\nBring a bag < 5kg";
    expect(eventDescriptionText(text)).toBe(text);
    expect(
      eventDescriptionText("<p>Food &amp; fun</p><h2>Schedule</h2><ul><li>Lunch</li></ul>")
    ).toContain("Food & fun");
    expect(eventDescriptionText("<h2>Schedule</h2>")).toBe("Schedule");
    expect(eventDescriptionText(null)).toBe("");
  });

  it("exports readable descriptions through both calendar paths used by emails", () => {
    const event = {
      id: "event",
      slug: "party",
      title: "Party",
      startAt: new Date("2030-01-01T18:00:00Z"),
      description: "<h2>Schedule</h2><p>Food &amp; fun</p><ul><li>Lunch</li></ul>",
    };
    const details = new URL(buildGoogleCalendarUrl(event)).searchParams.get("details")!;
    expect(details).toContain("Schedule");
    expect(details).toContain("Food & fun");
    expect(details).toContain("Lunch");
    expect(details).not.toMatch(/<[^>]+>|&amp;/);
    const ics = buildIcsContent(event).replace(/\r\n /g, "");
    expect(ics).toContain("Food & fun");
    expect(ics).not.toContain("<h2>");
  });
  it("uses plain text in public social metadata", () => {
    const event: SocialEvent = {
      slug: "party",
      title: "Party",
      description: "<h2>Food &amp; fun</h2><p>Bring <b>friends</b></p>",
      startAt: new Date("2030-01-01"),
      timezone: "America/Denver",
      visibility: "PUBLIC",
      status: "PUBLISHED",
      passwordHash: null,
      theme: null,
    };
    const metadata = buildEventSocialMetadata(event, event.slug);
    expect(metadata.description).toContain("Food & fun");
    expect(metadata.description).toContain("Bring friends");
    expect(metadata.description).not.toMatch(/<[^>]+>|&amp;/);
  });
});
