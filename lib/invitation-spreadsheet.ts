import {
  formatInvitationRecipient,
  isValidInvitationName,
  MAX_INVITATION_RECIPIENTS,
  MAX_INVITATION_TEXT,
  normalizeInvitationContact,
  type InvitationRecipient,
} from "./invitation-draft";

export interface InvitationSpreadsheetMapping {
  contactColumn: number;
  nameColumn?: number;
  hasHeader: boolean;
}

export type InvitationSpreadsheetIssueCode =
  | "textTooLong"
  | "tooManyRows"
  | "tooManyColumns"
  | "invalidQuote"
  | "unmatchedQuote"
  | "invalidMapping"
  | "missingCell"
  | "invalidName"
  | "invalidContact";

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

/** Parse clipboard TSV, preserving quoted cell newlines and escaped double quotes. */
export function parseInvitationSpreadsheet(text: string): InvitationSpreadsheet {
  if (text.length > MAX_INVITATION_TEXT) return { rows: [], issues: [{ code: "textTooLong" }] };
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
    if (char === "\t") {
      pushCell();
      if (row.length >= 32)
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

export interface InvitationSpreadsheetImport {
  /** Empty whenever there are issues: an invalid import never replaces the draft. */
  text: string;
  recipients: InvitationRecipient[];
  issues: InvitationSpreadsheetIssue[];
}

/** Explicit mapping is mandatory; this function never infers which cells are identities. */
export function importInvitationSpreadsheet(
  text: string,
  mapping: InvitationSpreadsheetMapping
): InvitationSpreadsheetImport {
  const parsed = parseInvitationSpreadsheet(text);
  const issues = [...parsed.issues];
  if (
    !mapping ||
    typeof mapping.hasHeader !== "boolean" ||
    !Number.isInteger(mapping.contactColumn) ||
    mapping.contactColumn < 0 ||
    mapping.contactColumn >= 32 ||
    (mapping.nameColumn !== undefined &&
      (!Number.isInteger(mapping.nameColumn) ||
        mapping.nameColumn < 0 ||
        mapping.nameColumn >= 32 ||
        mapping.nameColumn === mapping.contactColumn))
  ) {
    return { text: "", recipients: [], issues: [...issues, { code: "invalidMapping" }] };
  }
  const recipients: InvitationRecipient[] = [];
  let rawCount = 0;
  for (let index = mapping.hasHeader ? 1 : 0; index < parsed.rows.length; index++) {
    const row = parsed.rows[index];
    if (row.every((cell) => !cell.trim())) continue;
    rawCount++;
    const rawContact = row[mapping.contactColumn];
    const rawName = mapping.nameColumn === undefined ? undefined : row[mapping.nameColumn];
    if (rawContact === undefined || (mapping.nameColumn !== undefined && rawName === undefined)) {
      issues.push({ code: "missingCell", row: index });
      continue;
    }
    const contact = normalizeInvitationContact(rawContact);
    if (!contact)
      issues.push({ code: "invalidContact", row: index, column: mapping.contactColumn });
    // Empty name cells mean an explicitly unnamed recipient; control-only cells do not.
    const hasName =
      rawName !== undefined &&
      rawName !== "" &&
      (rawName.trim() !== "" || /[\u0000-\u001f\u007f-\u009f]/.test(rawName));
    const validName = !hasName || isValidInvitationName(rawName!);
    if (!validName) issues.push({ code: "invalidName", row: index, column: mapping.nameColumn });
    if (contact && validName)
      recipients.push({ contact, ...(hasName ? { name: rawName!.trim() } : {}) });
  }
  if (rawCount > MAX_INVITATION_RECIPIENTS) issues.push({ code: "tooManyRows" });
  // A mapping outside a nonempty grid is an error even when it has only a header.
  if (
    parsed.rows.length > 0 &&
    !parsed.rows.some(
      (row) =>
        mapping.contactColumn < row.length &&
        (mapping.nameColumn === undefined || mapping.nameColumn < row.length)
    )
  ) {
    issues.push({ code: "invalidMapping" });
  }
  if (issues.length > 0) return { text: "", recipients: [], issues };
  const canonical = recipients.map(formatInvitationRecipient).join("\n");
  if (canonical.length > MAX_INVITATION_TEXT)
    return { text: "", recipients: [], issues: [{ code: "textTooLong" }] };
  return { text: canonical, recipients, issues: [] };
}
