import { describe, expect, it } from "vitest";
import {
  describeInvitationRows,
  emptyInvitationDraft,
  invitationDraftReducer,
  type InvitationDraftAction,
  type InvitationDraftState,
} from "@/lib/invitation-draft-rows";

const both = { email: true, sms: true };
const run = (...actions: InvitationDraftAction[]) =>
  actions.reduce(invitationDraftReducer, emptyInvitationDraft);
const filled = (state: InvitationDraftState) =>
  state.rows.filter((row) => row.name || row.contact).map(({ name, contact }) => [name, contact]);

describe("invitation draft rows", () => {
  it("always keeps one blank row at the end for the next recipient", () => {
    const state = run({ type: "edit", id: "r0", field: "contact", value: "a@example.com" });
    expect(state.rows.map((row) => row.contact)).toEqual(["a@example.com", ""]);
    const cleared = invitationDraftReducer(state, {
      type: "edit",
      id: "r0",
      field: "contact",
      value: "",
    });
    expect(cleared.rows).toHaveLength(1);
  });

  it("describes each row's problem in place, or what it will send", () => {
    const state = run({
      type: "add",
      at: null,
      recipients: [
        { name: "Ann", contact: "ANN@example.com" },
        { name: "Bo", contact: "" },
        { name: "Cy", contact: "nope" },
        { name: "x".repeat(101), contact: "c@example.com" },
        { name: "Dup", contact: "ann@example.com" },
        { name: "", contact: "555-123-4567" },
      ],
    });
    expect(describeInvitationRows(state.rows, { email: true, sms: false })).toEqual([
      { kind: "ready", channel: "EMAIL", recipient: { contact: "ann@example.com", name: "Ann" } },
      { kind: "missingContact" },
      { kind: "invalidContact" },
      { kind: "invalidName" },
      { kind: "duplicate", of: 1 },
      { kind: "channelDisabled", channel: "SMS" },
      { kind: "empty" },
    ]);
  });

  it("skips exact repeats on bulk add but keeps a repeat with a different name", () => {
    const state = run(
      { type: "add", at: null, recipients: [{ name: "Ann", contact: "ann@example.com" }] },
      {
        type: "add",
        at: null,
        recipients: [
          { name: "ann ", contact: "ANN@example.com" },
          { name: "", contact: "ann@example.com" },
          { name: "Annie", contact: "ann@example.com" },
        ],
      }
    );
    expect(state.lastAdd).toEqual({ added: 1, skipped: 2 });
    expect(filled(state)).toEqual([
      ["Ann", "ann@example.com"],
      ["Annie", "ann@example.com"],
    ]);
    expect(describeInvitationRows(state.rows, both)[1]).toEqual({ kind: "duplicate", of: 1 });
  });

  it("inserts at the pasted row: replacing it when blank, after it otherwise", () => {
    const base = run({
      type: "add",
      at: null,
      recipients: [
        { name: "A", contact: "a@example.com" },
        { name: "C", contact: "c@example.com" },
      ],
    });
    const after = invitationDraftReducer(base, {
      type: "add",
      at: base.rows[0].id,
      recipients: [{ name: "B", contact: "b@example.com" }],
    });
    expect(filled(after).map(([name]) => name)).toEqual(["A", "B", "C"]);
    const blank = base.rows.at(-1)!;
    const replaced = invitationDraftReducer(base, {
      type: "add",
      at: blank.id,
      recipients: [{ name: "D", contact: "d@example.com" }],
    });
    expect(replaced.rows.map((row) => row.name)).toEqual(["A", "C", "D", ""]);
  });

  it("refuses a bulk add that would exceed 200 recipients and says how many fit", () => {
    const many = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({ name: "", contact: `${prefix}${i}@example.com` }));
    const state = run({ type: "add", at: null, recipients: many(150, "a") });
    const over = invitationDraftReducer(state, {
      type: "add",
      at: null,
      recipients: many(60, "b"),
    });
    expect(over.lastAdd).toEqual({ tooMany: 60, room: 50 });
    expect(filled(over)).toHaveLength(150);
  });

  it("undoes structural changes, and sent contacts never come back", () => {
    const added = run({
      type: "add",
      at: null,
      recipients: [
        { name: "A", contact: "a@example.com" },
        { name: "B", contact: "b@example.com" },
      ],
    });
    const removed = invitationDraftReducer(added, { type: "remove", id: added.rows[0].id });
    expect(filled(invitationDraftReducer(removed, { type: "undo" }))).toEqual(filled(added));
    const cleared = invitationDraftReducer(added, { type: "clear" });
    expect(filled(cleared)).toEqual([]);
    expect(filled(invitationDraftReducer(cleared, { type: "undo" }))).toEqual(filled(added));
    const sent = invitationDraftReducer(added, { type: "sent", contacts: ["a@example.com"] });
    expect(filled(sent)).toEqual([["B", "b@example.com"]]);
    expect(invitationDraftReducer(sent, { type: "undo" })).toBe(sent);
  });
});
