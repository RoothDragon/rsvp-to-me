import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";

/** The only HTML allowlist for event descriptions, on both save and display. */
export function sanitizeEventDescription(value: string | null | undefined): string {
  return sanitizeHtml(value ?? "", {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "blockquote",
      "a",
    ],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "iframe",
      "svg",
      "math",
      "template",
      "noscript",
      "object",
    ],
  });
}

/** Decode entities and retain readable lists/paragraphs for previews and exports. */
export function eventDescriptionText(value: string | null | undefined): string {
  return convert(sanitizeEventDescription(value), {
    wordwrap: false,
    preserveNewlines: true,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      ...["h1", "h2", "h3", "h4", "h5", "h6"].map((selector) => ({
        selector,
        options: { uppercase: false },
      })),
    ],
  }).trim();
}

/** Shared preview policy; limits count visible characters and logical lines, not HTML bytes. */
export const DESCRIPTION_PREVIEW_CHARACTERS = 1200;
export const DESCRIPTION_PREVIEW_LINES = 16;

/** Truncate sanitized markup at whole tags/entities, balancing the remaining ancestors. */
export function eventDescriptionPreview(value: string | null | undefined) {
  const safe = sanitizeEventDescription(value);
  // Attribute values may contain >; consume quoted attributes as part of the tag.
  const tokens =
    safe.match(/<(?:[^>"']|"[^"]*"|'[^']*')*>|&(?:#\d+|#x[\da-f]+|[a-z][\da-z]*);|[\s\S]/giu) ?? [];
  const stack: string[] = [];
  let html = "";
  let characters = 0;
  let lines = 1;
  let truncated = false;
  for (const token of tokens) {
    const tag = token.match(/^<(\/)?([a-z][\da-z]*)/i);
    if (tag?.[1]) {
      html += token;
      stack.pop();
      if (/^(p|li|h[1-6])$/.test(tag[2])) lines++;
      continue;
    }
    if (characters >= DESCRIPTION_PREVIEW_CHARACTERS || lines > DESCRIPTION_PREVIEW_LINES) {
      truncated = true;
      break;
    }
    html += token;
    if (tag) {
      if (tag[2] === "br" || tag[2] === "hr") lines++;
      else stack.push(tag[2]);
    } else {
      characters++;
      if (token === "\n") lines++;
    }
  }
  if (!truncated) return { html: safe, truncated: false };
  html += stack
    .reverse()
    .map((tag) => `</${tag}>`)
    .join("");
  // Reapply the same allowlist; no clipped, empty links enter the tab order.
  return {
    html: sanitizeHtml(sanitizeEventDescription(html), {
      allowedTags: false,
      allowedAttributes: false,
      exclusiveFilter: (frame) => frame.tag === "a" && !frame.text.trim(),
    }),
    truncated: true,
  };
}
