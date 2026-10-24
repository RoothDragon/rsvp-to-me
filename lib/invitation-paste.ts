/**
 * Lenient paste parsing for the invitation composer. It only turns pasted text
 * into editable draft rows; server actions keep the strict grammar in
 * invitation-draft.ts, and every row is still validated before review.
 */
import { MAX_INVITATION_TEXT, normalizeInvitationContact } from "./invitation-draft";

export interface PastedRecipient {
  /** Raw display name; empty when the line had none. */
  name: string;
  /** Raw contact text; empty when the line had no recognizable contact. */
  contact: string;
}

export interface InvitationPaste {
  rows: PastedRecipient[];
  tooLong: boolean;
}

const EMAIL_RUN = /[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+/g;
const PHONE_RUN = /\+?\(?\d[\d\s().-]*\d/g;
const ANGLE = /<([^<>]*)>/g;
const EDGE_SEPARATORS = /^[\s,;:|<>–—-]+|[\s,;:|<>–—-]+$/g;

interface Span {
  start: number;
  end: number;
  contact: string;
}

/** Marks characters inside double quotes, honouring `""` and `\"` escapes. */
function quoteMask(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === "\\" && i + 1 < text.length) {
      mask[i] = mask[i + 1] = true;
      i++;
      continue;
    }
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        mask[i] = mask[i + 1] = true;
        i++;
        continue;
      }
      mask[i] = true;
      quoted = !quoted;
      continue;
    }
    mask[i] = quoted;
  }
  return mask;
}

/**
 * Splits on separators outside quotes, dropping blank pieces. Within a line,
 * separators inside `<…>` are ignored too; a missing `>` never spans lines.
 */
function splitOutside(text: string, separators: string): string[] {
  const mask = quoteMask(text);
  const pieces: string[] = [];
  const trackAngles = !separators.includes("\n");
  let start = 0;
  let angle = false;
  for (let i = 0; i < text.length; i++) {
    if (mask[i]) continue;
    if (trackAngles && text[i] === "<") angle = true;
    else if (trackAngles && text[i] === ">") angle = false;
    else if (!angle && separators.includes(text[i])) {
      pieces.push(text.slice(start, i));
      if (text[i] === "\r" && text[i + 1] === "\n") i++;
      start = i + 1;
    }
  }
  pieces.push(text.slice(start));
  return pieces.filter((piece) => piece.trim());
}

/** Something the host meant as a contact, even if it is not a valid one. */
function looksLikeContact(piece: string): boolean {
  return piece.includes("@") || /^\+?[\d\s().-]{5,}$/.test(piece);
}

function contactSpans(line: string, mask: boolean[]): Span[] {
  const spans: Span[] = [];
  const free = (start: number, end: number) =>
    !mask[start] && !spans.some((span) => start < span.end && end > span.start);
  // Angle brackets always mark the contact, even an invalid one, so the row
  // keeps its name and shows the contact as needing a fix.
  for (const match of line.matchAll(ANGLE)) {
    const start = match.index;
    if (!mask[start]) {
      spans.push({ start, end: start + match[0].length, contact: match[1].trim() });
    }
  }
  for (const match of line.matchAll(EMAIL_RUN)) {
    const text = match[0].replace(/\.+$/, "");
    const start = match.index;
    if (free(start, start + text.length) && normalizeInvitationContact(text)) {
      spans.push({ start, end: start + text.length, contact: text });
    }
  }
  for (const match of line.matchAll(PHONE_RUN)) {
    const start = match.index;
    const text = match[0];
    if (free(start, start + text.length) && normalizeInvitationContact(text)) {
      spans.push({ start, end: start + text.length, contact: text });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function decodeQuoted(name: string): string {
  if (name.length < 2 || !name.startsWith('"') || !name.endsWith('"')) return name;
  return name
    .slice(1, -1)
    .replace(/\\(["\\])/g, "$1")
    .replace(/""/g, '"');
}

function cleanName(raw: string): string {
  const name = raw
    .replace(/\(\s*\)/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(EDGE_SEPARATORS, "");
  return decodeQuoted(name).trim();
}

function separatorAfter(line: string, mask: boolean[], from: number, to: number): number {
  for (let i = from; i < to; i++) {
    if (line[i] === "," && !mask[i]) return i;
  }
  return -1;
}

/**
 * The comma-separated pieces of a line when each is a bare contact or a bare
 * name; null when any piece mixes the two or holds something else.
 */
function barePieces(line: string): PastedRecipient[] | null {
  const pieces: PastedRecipient[] = [];
  for (const piece of splitOutside(line, ",")) {
    const spans = contactSpans(piece, quoteMask(piece));
    if (spans.length === 1) {
      const [span] = spans;
      if (cleanName(piece.slice(0, span.start) + " " + piece.slice(span.end))) return null;
      pieces.push({ name: "", contact: span.contact });
    } else if (spans.length === 0 && !looksLikeContact(piece.trim())) {
      pieces.push({ name: cleanName(piece), contact: "" });
    } else {
      return null;
    }
  }
  return pieces;
}

/**
 * Bare names and contacts on one line, such as `a@x, Alice, b@y, Bob`. A line
 * that starts with a contact and ends with a name lists each name after its
 * contact. Otherwise a name at either end belongs to the contact beside it,
 * and a name between two contacts, which could belong to either, becomes its
 * own row for the host to fix. Name-first lines return null for the general rule.
 */
function parseBarePieces(line: string): PastedRecipient[] | null {
  const pieces = barePieces(line);
  if (!pieces?.some((piece) => !piece.contact)) return null;
  // Adjacent names are one name, as in `Smith, Alice`.
  const groups: PastedRecipient[] = [];
  for (const piece of pieces) {
    const last = groups.at(-1);
    if (!piece.contact && last && !last.contact) last.name += `, ${piece.name}`;
    else groups.push({ ...piece });
  }
  const leadsWithName = !groups[0].contact;
  const endsWithName = !groups.at(-1)!.contact;
  if (leadsWithName && !endsWithName) return null;
  const contactFirst = !leadsWithName && endsWithName;
  const rows: PastedRecipient[] = [];
  groups.forEach((group, index) => {
    if (group.contact) {
      rows.push({
        name: index === 1 && leadsWithName ? groups[0].name : "",
        contact: group.contact,
      });
    } else if (index > 0 && (contactFirst || index === groups.length - 1)) {
      rows.at(-1)!.name = group.name;
    } else if (index > 0) {
      rows.push(group);
    }
  });
  return rows;
}

/** One `;`-separated part of a line; commas may separate a name from its contact or recipients. */
function parseSegment(line: string): PastedRecipient[] {
  const mask = quoteMask(line);
  const spans = contactSpans(line, mask);
  const recipient = (from: number, to: number, span: Span): PastedRecipient => ({
    name: cleanName(line.slice(from, span.start) + " " + line.slice(span.end, to)),
    contact: span.contact,
  });
  if (spans.length === 0) {
    // No valid contact: keep everything as rows the host can complete or fix.
    const pieces = splitOutside(line, ",").map((piece) => piece.trim());
    const contacts = pieces.filter(looksLikeContact);
    if (contacts.length === 1) {
      const name = cleanName(pieces.filter((piece) => piece !== contacts[0]).join(", "));
      return [{ name, contact: contacts[0] }];
    }
    return pieces
      .map((piece) =>
        looksLikeContact(piece)
          ? { name: "", contact: piece }
          : { name: cleanName(piece), contact: "" }
      )
      .filter((row) => row.name || row.contact);
  }
  if (spans.length === 1) return [recipient(0, line.length, spans[0])];
  const bare = parseBarePieces(line);
  if (bare) return bare;
  // Several contacts: each recipient ends at the first separator after its
  // contact, or right after the contact when none comes before the next one
  // (a name otherwise precedes its contact).
  const rows: PastedRecipient[] = [];
  let start = 0;
  spans.forEach((span, index) => {
    const last = index === spans.length - 1;
    const limit = last ? line.length : spans[index + 1].start;
    const separator = separatorAfter(line, mask, span.end, limit);
    const end = last ? limit : separator !== -1 ? separator : span.end;
    rows.push(recipient(start, end, span));
    start = !last && separator !== -1 ? separator + 1 : end;
  });
  return rows;
}

/**
 * Accepts `Name <contact>`, `"Last, First" <contact>`, `Name contact`,
 * `Name, contact`, `contact, Name`, and bare contacts, separated by new lines,
 * commas or semicolons.
 */
export function parseInvitationPaste(text: string): InvitationPaste {
  if (text.length > MAX_INVITATION_TEXT) return { rows: [], tooLong: true };
  const segments = splitOutside(text, "\r\n").flatMap((line) => splitOutside(line, ";"));
  return { rows: segments.flatMap(parseSegment), tooLong: false };
}
