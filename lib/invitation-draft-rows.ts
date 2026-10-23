/**
 * The invitation composer's editable recipient rows. Rows hold raw text so
 * hosts can fix typos in place; `describeInvitationRows` decides what is
 * ready for review. Review/send still go through the server's strict checks.
 */
import {
  invitationContactKey,
  isValidInvitationName,
  MAX_INVITATION_RECIPIENTS,
  type InvitationRecipient,
} from "./invitation-draft";
import type { PastedRecipient } from "./invitation-paste";

export interface InvitationDraftRow {
  id: string;
  name: string;
  contact: string;
  /** Added by a paste or import, so its problems show without waiting for a blur. */
  bulk?: true;
}

export type InvitationChannel = "EMAIL" | "SMS";

export type InvitationRowStatus =
  | { kind: "empty" }
  | { kind: "ready"; channel: InvitationChannel; recipient: InvitationRecipient }
  | { kind: "missingContact" }
  | { kind: "invalidContact" }
  | { kind: "invalidName" }
  | { kind: "channelDisabled"; channel: InvitationChannel }
  /** `of` is the 1-based position of the row that already has this contact. */
  | { kind: "duplicate"; of: number };

export function isBlankInvitationRow(row: Pick<InvitationDraftRow, "name" | "contact">): boolean {
  return !row.name.trim() && !row.contact.trim();
}

export function describeInvitationRows(
  rows: InvitationDraftRow[],
  channelConfig: { email: boolean; sms: boolean }
): InvitationRowStatus[] {
  const seen = new Map<string, number>();
  return rows.map((row, index) => {
    if (isBlankInvitationRow(row)) return { kind: "empty" };
    if (!row.contact.trim()) return { kind: "missingContact" };
    const contact = invitationContactKey(row.contact);
    if (!contact) return { kind: "invalidContact" };
    const name = row.name.trim();
    if (name && !isValidInvitationName(row.name)) return { kind: "invalidName" };
    const first = seen.get(contact);
    if (first !== undefined) return { kind: "duplicate", of: first + 1 };
    seen.set(contact, index);
    const channel: InvitationChannel = contact.includes("@") ? "EMAIL" : "SMS";
    if (!(channel === "EMAIL" ? channelConfig.email : channelConfig.sms)) {
      return { kind: "channelDisabled", channel };
    }
    return { kind: "ready", channel, recipient: { contact, ...(name ? { name } : {}) } };
  });
}

export interface InvitationDraftState {
  rows: InvitationDraftRow[];
  /** Snapshots before structural changes (adds, removals, clears); typing is not undoable. */
  history: InvitationDraftRow[][];
  nextId: number;
  /** Outcome of the latest bulk add, for the composer's status line. */
  lastAdd: { added: number; skipped: number } | { tooMany: number; room: number } | null;
}

export type InvitationDraftAction =
  | { type: "edit"; id: string; field: "name" | "contact"; value: string }
  /** Replaces the row `at` when it is blank, otherwise inserts after it; null appends. */
  | { type: "add"; at: string | null; recipients: PastedRecipient[] }
  | { type: "remove"; id: string }
  | { type: "clear" }
  | { type: "undo" }
  /** Drops delivered contacts; sent rows must not come back through undo. */
  | { type: "sent"; contacts: string[] };

const HISTORY_LIMIT = 20;

export const emptyInvitationDraft: InvitationDraftState = {
  rows: [{ id: "r0", name: "", contact: "" }],
  history: [],
  nextId: 1,
  lastAdd: null,
};

/** Keeps exactly one blank row at the end for typing the next recipient. */
function withTrailingBlank(state: InvitationDraftState): InvitationDraftState {
  const rows = [...state.rows];
  while (
    rows.length > 1 &&
    isBlankInvitationRow(rows.at(-1)!) &&
    isBlankInvitationRow(rows.at(-2)!)
  )
    rows.pop();
  if (!rows.length || !isBlankInvitationRow(rows.at(-1)!)) {
    rows.push({ id: `r${state.nextId}`, name: "", contact: "" });
    return { ...state, rows, nextId: state.nextId + 1 };
  }
  return { ...state, rows };
}

function snapshot(state: InvitationDraftState): InvitationDraftRow[][] {
  return [...state.history.slice(-(HISTORY_LIMIT - 1)), state.rows];
}

function sameName(a: string, b: string): boolean {
  return (
    a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase()
  );
}

function add(
  state: InvitationDraftState,
  at: string | null,
  recipients: PastedRecipient[]
): InvitationDraftState {
  const used = state.rows.filter((row) => !isBlankInvitationRow(row));
  const incoming = recipients.filter((row) => !isBlankInvitationRow(row));
  const target = at === null ? undefined : state.rows.find((row) => row.id === at);
  const replacesTarget = !!target && isBlankInvitationRow(target);
  const room = MAX_INVITATION_RECIPIENTS - used.length;
  // Skip exact repeats (same contact, same or no name); differing names stay
  // so the host can choose, and are flagged as duplicates.
  const existing = [...used];
  let skipped = 0;
  const additions: InvitationDraftRow[] = [];
  let nextId = state.nextId;
  for (const recipient of incoming) {
    const key = invitationContactKey(recipient.contact);
    const repeat =
      key !== null &&
      existing.some(
        (row) =>
          invitationContactKey(row.contact) === key &&
          (!recipient.name.trim() || sameName(row.name, recipient.name))
      );
    if (repeat) {
      skipped++;
      continue;
    }
    const row: InvitationDraftRow = {
      id: `r${nextId++}`,
      name: recipient.name,
      contact: recipient.contact,
      bulk: true,
    };
    additions.push(row);
    existing.push(row);
  }
  if (additions.length > room) {
    return { ...state, lastAdd: { tooMany: additions.length, room: Math.max(0, room) } };
  }
  const rows = [...state.rows];
  if (target) {
    const index = rows.indexOf(target);
    if (replacesTarget) rows.splice(index, 1, ...additions);
    else rows.splice(index + 1, 0, ...additions);
  } else {
    const end = rows.length && isBlankInvitationRow(rows.at(-1)!) ? rows.length - 1 : rows.length;
    rows.splice(end, 0, ...additions);
  }
  return withTrailingBlank({
    ...state,
    rows,
    nextId,
    history: additions.length ? snapshot(state) : state.history,
    lastAdd: { added: additions.length, skipped },
  });
}

export function invitationDraftReducer(
  state: InvitationDraftState,
  action: InvitationDraftAction
): InvitationDraftState {
  switch (action.type) {
    case "edit":
      return withTrailingBlank({
        ...state,
        lastAdd: null,
        rows: state.rows.map((row) =>
          row.id === action.id ? { ...row, [action.field]: action.value } : row
        ),
      });
    case "add":
      return add(state, action.at, action.recipients);
    case "remove":
      return withTrailingBlank({
        ...state,
        history: snapshot(state),
        lastAdd: null,
        rows: state.rows.filter((row) => row.id !== action.id),
      });
    case "clear":
      return withTrailingBlank({
        ...state,
        history: snapshot(state),
        lastAdd: null,
        rows: [],
      });
    case "undo": {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { ...state, rows: previous, history: state.history.slice(0, -1), lastAdd: null };
    }
    case "sent": {
      const sent = new Set(action.contacts);
      return withTrailingBlank({
        ...state,
        history: [],
        lastAdd: null,
        rows: state.rows.filter((row) => !sent.has(invitationContactKey(row.contact) ?? "")),
      });
    }
  }
}
