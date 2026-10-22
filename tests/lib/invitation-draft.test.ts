import { describe, expect, it } from "vitest";
import {
  formatInvitationRecipient,
  invitationContactKey,
  normalizeInvitationContact,
  parseInvitationDraft,
  replaceInvitationSpan,
} from "@/lib/invitation-draft";

describe("invitation draft syntax", () => {
  it("bounds work for long malformed mailbox whitespace without losing the issue", () => {
    const text = "A>" + " ".repeat(99_000) + "junk";
    const result = parseInvitationDraft(text);
    expect(result.entries).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ start: 0, end: text.length });
  });
  it("accepts mixed bare, named, email, phone, comma and newline recipients", () => {
    const result = parseInvitationDraft(
      "JANE@EXAMPLE.COM, Jane Doe <jane2@example.com>\r\n+1 (555) 123-4567\nSam <555.222.1234>"
    );
    expect(result.issues).toEqual([]);
    expect(result.entries.map(({ contact, name }) => ({ contact, name }))).toEqual([
      { contact: "jane@example.com", name: undefined },
      { contact: "jane2@example.com", name: "Jane Doe" },
      { contact: "+15551234567", name: undefined },
      { contact: "5552221234", name: "Sam" },
    ]);
    expect(result.rawCount).toBe(4);
  });

  it("decodes commas, escaped quotes/backslashes and doubled quotes in names", () => {
    const text =
      '"Doe, Jane" <jane@example.com>, "A \\"B\\" \\\\ C" <b@example.com>, "A ""C""" <c@example.com>';
    const result = parseInvitationDraft(text);
    expect(result.issues).toEqual([]);
    expect(result.entries.map((entry) => entry.name)).toEqual(["Doe, Jane", 'A "B" \\ C', 'A "C"']);
  });

  it("round-trips the canonical formatter without changing Unicode names", () => {
    const recipient = { name: '  Zoë 👩🏽‍💻, "Guest" <team> \\  ', contact: "ZOE@EXAMPLE.COM" };
    const canonical = formatInvitationRecipient(recipient);
    const result = parseInvitationDraft(canonical);
    expect(result.issues).toEqual([]);
    expect(result.entries[0]).toEqual({
      name: recipient.name.trim(),
      contact: "zoe@example.com",
      start: 0,
      end: canonical.length,
    });
  });

  it("preserves exact UTF-16 source spans through emoji and CRLF", () => {
    const first = '"😀 Guest" <a@example.com>';
    const second = "  invalid target ";
    const last = " b@example.com";
    const text = first + "\r\n" + second + "," + last;
    const result = parseInvitationDraft(text);
    expect(result.entries[0]).toMatchObject({ start: 0, end: first.length });
    expect(result.issues[0]).toMatchObject({
      start: first.length + 2,
      end: first.length + 2 + second.length,
    });
    expect(text.slice(result.issues[0].start, result.issues[0].end)).toBe(second);
    expect(text.slice(result.entries[1].start, result.entries[1].end)).toBe(last);
    const fixed = replaceInvitationSpan(
      text,
      result.issues[0].start,
      result.issues[0].end,
      "c@example.com"
    );
    expect(parseInvitationDraft(fixed).entries).toHaveLength(3);
  });

  it("keeps duplicates for explicit resolution and shares canonical identity keys", () => {
    const result = parseInvitationDraft("A@EXAMPLE.COM,a@example.com,555-123-4567,(555) 123.4567");
    expect(result.entries).toHaveLength(4);
    expect(result.issues).toEqual([]);
    expect(invitationContactKey(result.entries[0].contact)).toBe(
      invitationContactKey(result.entries[1].contact)
    );
    expect(invitationContactKey(result.entries[2].contact)).toBe(
      invitationContactKey(result.entries[3].contact)
    );
    expect(invitationContactKey("+1 555 123 4567")).not.toBe(invitationContactKey("555 123 4567"));
  });

  it.each([
    ["a@example.com b@example.com", "missingDelimiter", "a@example.com, b@example.com"],
    ['"Doe, Jane <a@example.com>', "unmatchedQuote", '"Doe, Jane" <a@example.com>'],
    ["Jane <a@example.com", "invalidMailbox", "Jane <a@example.com>"],
    [
      '"Doe Jane" <a@example.com> Sam <b@example.com>',
      "missingDelimiter",
      '"Doe Jane" <a@example.com>, Sam <b@example.com>',
    ],
  ])("offers a user-applied repair for %s", (text, code, suggestedReplacement) => {
    const result = parseInvitationDraft(text);
    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([{ code, start: 0, end: text.length, suggestedReplacement }]);
    expect(parseInvitationDraft(suggestedReplacement).issues).toEqual([]);
  });

  it.each([
    '"never closed\\',
    "Jane <<a@example.com>>",
    "Jane <a@example.com> trailing",
    "a@example.com>",
    "<a@example.com>",
    '"" <a@example.com>',
    '"A\nB" <a@example.com>',
    '"A\tB" <a@example.com>',
    '"A\u0085B" <a@example.com>',
    '"bad\\q" <a@example.com>',
    "broken",
    "123-45",
    "---()---",
  ])("keeps malformed nonempty input visible as an issue: %s", (text) => {
    const result = parseInvitationDraft(text);
    expect(result.rawCount).toBe(1);
    expect(result.entries).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ start: 0, end: text.length });
  });

  it("enforces name/contact bounds and counts invalid tokens before filtering", () => {
    expect(parseInvitationDraft(`"${"😀".repeat(50)}" <a@example.com>`).issues).toEqual([]);
    expect(parseInvitationDraft(`"${"😀".repeat(51)}" <a@example.com>`).issues[0].code).toBe(
      "invalidName"
    );
    expect(normalizeInvitationContact("a".repeat(243) + "@example.com")).toBeNull();
    expect(normalizeInvitationContact("1".repeat(41))).toBeNull();
    expect(normalizeInvitationContact("+1" + " ".repeat(40) + "234567")).toBeNull();
    const result = parseInvitationDraft(Array(201).fill("invalid").join(","));
    expect(result.entries).toEqual([]);
    expect(result.rawCount).toBe(201);
    expect(result.issues[0].code).toBe("tooManyRecipients");
    expect(parseInvitationDraft(" ".repeat(100_001)).issues[0].code).toBe("textTooLong");
    expect(parseInvitationDraft(" ,\r\n , ")).toEqual({ entries: [], issues: [], rawCount: 0 });
  });

  it("leaves ambiguous missing quotes for manual repair instead of merging recipients", () => {
    const text = '"Alice <alice@example.com>, Bob <bob@example.com>';
    const result = parseInvitationDraft(text);
    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([
      {
        code: "unmatchedQuote",
        start: 0,
        end: text.length,
      },
    ]);
  });

  it("rejects invalid formatter input and unsafe source ranges", () => {
    expect(() => formatInvitationRecipient({ contact: "bad" })).toThrow();
    expect(() => formatInvitationRecipient({ contact: "a@example.com", name: " " })).toThrow();
    expect(() => replaceInvitationSpan("abc", -1, 2, "")).toThrow(RangeError);
    expect(() => replaceInvitationSpan("abc", 2, 1, "")).toThrow(RangeError);
    expect(() => replaceInvitationSpan("abc", 0, 4, "")).toThrow(RangeError);
    expect(() => replaceInvitationSpan("😀a", 1, 2, "")).toThrow(RangeError);
    expect(replaceInvitationSpan("😀a", 0, 2, "Z")).toBe("Za");
    expect(() =>
      replaceInvitationSpan("b@example.com", 0, 13, "x@example.com", "a@example.com")
    ).toThrow(/stale/);
    expect(replaceInvitationSpan("a@example.com", 0, 13, "x@example.com", "a@example.com")).toBe(
      "x@example.com"
    );
  });
});
