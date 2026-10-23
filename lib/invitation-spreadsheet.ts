import { MAX_INVITATION_RECIPIENTS, normalizeInvitationContact } from "./invitation-draft";
import type { PastedRecipient } from "./invitation-paste";

export type InvitationSpreadsheetDelimiter = "\t" | "," | ";";

/** Contact-app exports (Google, Outlook) carry many columns and long rows. */
export const MAX_INVITATION_COLUMNS = 256;
export const MAX_INVITATION_IMPORT_TEXT = 2_000_000;

export interface InvitationSpreadsheetMapping {
  hasHeader: boolean;
  /** Joined with spaces in this order; at most three (e.g. first, middle, last). */
  nameColumns: number[];
  /** The first cell holding a valid contact wins; at most two (e.g. email, then mobile). */
  contactColumns: number[];
}

export type InvitationSpreadsheetIssueCode =
  | "textTooLong"
  | "tooManyRows"
  | "tooManyColumns"
  | "invalidQuote"
  | "unmatchedQuote"
  | "invalidMapping";

export interface InvitationSpreadsheetIssue {
  code: InvitationSpreadsheetIssueCode;
  /** Zero-based row/column indexes in the parsed grid, before header removal. */
  row?: number;
  column?: number;
}

export interface InvitationSpreadsheet {
  rows: string[][];
  issues: InvitationSpreadsheetIssue[];
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Tabs (clipboard cells) win; otherwise the more frequent of `;` and `,` in the first row. */
export function detectInvitationDelimiter(text: string): InvitationSpreadsheetDelimiter {
  const counts = { "\t": 0, ",": 0, ";": 0 };
  let quoted = false;
  for (const char of stripBom(text)) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char in counts) counts[char as InvitationSpreadsheetDelimiter]++;
  }
  if (counts["\t"] > 0) return "\t";
  return counts[";"] > counts[","] ? ";" : ",";
}

/** Parse delimited text, preserving quoted delimiters/newlines and `""` escapes. */
export function parseInvitationSpreadsheet(
  source: string,
  delimiter: InvitationSpreadsheetDelimiter = "\t"
): InvitationSpreadsheet {
  const text = stripBom(source);
  if (text.length > MAX_INVITATION_IMPORT_TEXT) {
    return { rows: [], issues: [{ code: "textTooLong" }] };
  }
  const rows: string[][] = [];
  const issues: InvitationSpreadsheetIssue[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let rowTouched = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closedQuote = false;
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    rowTouched = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    rowTouched = true;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else cell += char;
      continue;
    }
    if (char === delimiter) {
      pushCell();
      if (row.length >= MAX_INVITATION_COLUMNS)
        return { rows, issues: [...issues, { code: "tooManyColumns", row: rows.length }] };
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRow();
      // One optional header plus at most 200 rows, including invalid/blank rows.
      if (rows.length > MAX_INVITATION_RECIPIENTS + 1) {
        return { rows, issues: [...issues, { code: "tooManyRows" }] };
      }
    } else if (char === '"' && cell === "" && !closedQuote) {
      quoted = true;
    } else {
      if (char === '"' || closedQuote) {
        issues.push({ code: "invalidQuote", row: rows.length, column: row.length });
      }
      cell += char;
    }
  }
  if (quoted) issues.push({ code: "unmatchedQuote", row: rows.length, column: row.length });
  if (rowTouched || row.length > 0 || cell.length > 0) pushRow();
  if (rows.length > MAX_INVITATION_RECIPIENTS + 1) issues.push({ code: "tooManyRows" });
  return { rows, issues };
}

export function invitationSpreadsheetWidth(rows: string[][]): number {
  return rows.reduce((width, row) => Math.max(width, row.length), 0);
}

export function isValidInvitationSpreadsheetMapping(
  mapping: InvitationSpreadsheetMapping,
  width: number
): boolean {
  const columns = [...mapping.nameColumns, ...mapping.contactColumns];
  return (
    typeof mapping.hasHeader === "boolean" &&
    mapping.contactColumns.length >= 1 &&
    mapping.contactColumns.length <= 2 &&
    mapping.nameColumns.length <= 3 &&
    columns.every((column) => Number.isInteger(column) && column >= 0 && column < width) &&
    new Set(columns).size === columns.length
  );
}

type ContactKind = "email" | "phone";

function contactKind(cell: string | undefined, strictPhone = false): ContactKind | null {
  const contact = normalizeInvitationContact(cell ?? "");
  if (!contact) return null;
  if (contact.includes("@")) return "email";
  // Without a phone header, short digit runs are more likely dates or IDs.
  if (strictPhone && !contact.startsWith("+") && contact.length < 10) return null;
  return "phone";
}

const HEADERS = {
  fullName: /^(full |display )?name$/,
  firstName: /^(first|given)[ _-]?name$/,
  middleName: /^(middle|additional)[ _-]?name$/,
  lastName: /^((last|family)[ _-]?name|surname)$/,
  email: /e-?mail/,
  phone: /phone|mobile|cell|^tel/,
};

/**
 * A starting mapping for the host to confirm or change: header names first,
 * then the cell values themselves. Import still requires an explicit mapping.
 */
export function suggestInvitationSpreadsheetMapping(
  rows: string[][]
): InvitationSpreadsheetMapping {
  const width = invitationSpreadsheetWidth(rows);
  const columns = Array.from({ length: width }, (_, column) => column);
  const first = rows[0] ?? [];
  const hasHeader =
    rows.length > 1 &&
    !first.some((cell) => contactKind(cell)) &&
    first.some((cell) => /\p{L}/u.test(cell)) &&
    rows.slice(1).some((row) => row.some((cell) => contactKind(cell)));
  const data = hasHeader ? rows.slice(1) : rows;
  const header = hasHeader ? first.map((cell) => cell.trim().toLowerCase()) : [];
  const named = (pattern: RegExp) => columns.filter((column) => pattern.test(header[column] ?? ""));
  const filled = (column: number) => data.some((row) => row[column]?.trim());

  const best = (candidates: number[], kind: ContactKind, strictPhone: boolean) =>
    candidates
      .map((column) => ({
        column,
        count: data.filter((row) => contactKind(row[column], strictPhone) === kind).length,
      }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count || a.column - b.column)[0]?.column;
  const email = best(named(HEADERS.email), "email", false) ?? best(columns, "email", false);
  const phone = best(named(HEADERS.phone), "phone", false) ?? best(columns, "phone", true);
  const contactColumns = [email, phone].filter((column) => column !== undefined);

  let nameColumns: number[] = [];
  const fullName = named(HEADERS.fullName).find(filled);
  if (fullName !== undefined) nameColumns = [fullName];
  else if (hasHeader) {
    nameColumns = [HEADERS.firstName, HEADERS.middleName, HEADERS.lastName]
      .map((pattern) => named(pattern).find(filled))
      .filter((column) => column !== undefined);
  }
  if (!nameColumns.length) {
    // No usable header: the column with the most text that is not a contact.
    const text = columns
      .filter((column) => !contactColumns.includes(column))
      .map((column) => ({
        column,
        count: data.filter((row) => /\p{L}/u.test(row[column] ?? "") && !contactKind(row[column]))
          .length,
      }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count || a.column - b.column)[0];
    if (text) nameColumns = [text.column];
  }
  return {
    hasHeader,
    nameColumns: nameColumns.filter((column) => !contactColumns.includes(column)),
    contactColumns,
  };
}

export interface InvitationSpreadsheetImport {
  /** Raw rows for the draft; invalid names or contacts are flagged there, not dropped. */
  recipients: PastedRecipient[];
  issues: InvitationSpreadsheetIssue[];
}

export function importInvitationSpreadsheet(
  rows: string[][],
  mapping: InvitationSpreadsheetMapping
): InvitationSpreadsheetImport {
  if (!isValidInvitationSpreadsheetMapping(mapping, invitationSpreadsheetWidth(rows))) {
    return { recipients: [], issues: [{ code: "invalidMapping" }] };
  }
  const mapped = [...mapping.nameColumns, ...mapping.contactColumns];
  const recipients: PastedRecipient[] = [];
  for (const row of rows.slice(mapping.hasHeader ? 1 : 0)) {
    if (mapped.every((column) => !row[column]?.trim())) continue;
    const name = mapping.nameColumns
      .map((column) => row[column]?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    const contacts = mapping.contactColumns
      .map((column) => row[column]?.trim() ?? "")
      .filter(Boolean);
    const contact = contacts.find((cell) => normalizeInvitationContact(cell)) ?? contacts[0] ?? "";
    recipients.push({ name, contact });
  }
  if (recipients.length > MAX_INVITATION_RECIPIENTS) {
    return { recipients: [], issues: [{ code: "tooManyRows" }] };
  }
  return { recipients, issues: [] };
}
