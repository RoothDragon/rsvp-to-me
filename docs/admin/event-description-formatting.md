---
title: Event Description Formatting
description: Safe HTML descriptions, editing, and plain-text exports.
category: Configuration
audience: admin
order: 91
---

# Event description formatting

Event descriptions accept basic HTML and remain compatible with existing plain
text and line breaks. Both create and inline-edit actions enforce the existing
10,000-character input limit and sanitize HTML. Display and editor previews
sanitize again so previously saved or imported content cannot bypass the allowlist.

Allowed elements are paragraphs, line breaks, strong/bold, emphasis/italics,
underline, strikethrough, lists/items, headings, horizontal rules, blockquotes,
and anchors. Anchors retain only `href` and `title`; URLs are limited to HTTP,
HTTPS, and relative links. Protocol-relative links are excluded. Scripts, event
handlers, styles, frames, SVG/MathML, images, and other embedded content are
removed. No external media is fetched by description rendering.

The browser uses the same allowlist as the server. Descriptions start collapsed
when they exceed 1,200 visible characters or 16 logical lines. Both views render
sanitized HTML, preserving headings, lists, emphasis, rules, and links. The shared
preview policy in `lib/event-description.ts` truncates at complete tags/entities
and closes open ancestors; omitted content and links are absent from the DOM.
These are application defaults, without per-event configuration.

Event cover images link to their full uploaded image in a new tab. Links have an
accessible label and keyboard focus indicator; host upload/remove controls remain
separate. Only HTTP/HTTPS image URLs become links. No upload limits change.

Calendar links/ICS and public social metadata use entity-decoded plain text with
paragraph/list boundaries. Email calendar links share that conversion. No database
migration, environment variable, or deployment change is required. The application
image must be rebuilt to include the new sanitizer dependency.
