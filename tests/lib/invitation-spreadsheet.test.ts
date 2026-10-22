import { describe, expect, it } from "vitest";
import { parseInvitationDraft } from "@/lib/invitation-draft";
import {
  importInvitationSpreadsheet,
  parseInvitationSpreadsheet,
} from "@/lib/invitation-spreadsheet";

describe("invitation spreadsheet clipboard", () => {
  it("parses quoted tabs/newlines, double quotes and CRLF without splitting cells", () => {
    const result = parseInvitationSpreadsheet(
      'Name\tContact\r\n"Doe, ""Jane"""\ta@example.com\r\n"A\tB\nC"\tb@example.com\r\n'
    );
    expect(result).toEqual({
      rows: [
        ["Name", "Contact"],
        ['Doe, "Jane"', "a@example.com"],
        ["A\tB\nC", "b@example.com"],
      ],
      issues: [],
    });
  });

  it("imports reversed explicit columns and optional header into canonical draft text", () => {
    const result = importInvitationSpreadsheet(
      "Email\tIgnored\tName\r\nA@EXAMPLE.COM\tnotes\tDoe, Jane\r\n555-123-4567\tnotes\tSam",
      { contactColumn: 0, nameColumn: 2, hasHeader: true }
    );
    expect(result.issues).toEqual([]);
    expect(result.recipients).toEqual([
      { contact: "a@example.com", name: "Doe, Jane" },
      { contact: "5551234567", name: "Sam" },
    ]);
    expect(result.text).toBe('"Doe, Jane" <a@example.com>\n"Sam" <5551234567>');
    expect(parseInvitationDraft(result.text).issues).toEqual([]);
    const reversed = importInvitationSpreadsheet("Sam\tSAM@EXAMPLE.COM", {
      contactColumn: 1,
      nameColumn: 0,
      hasHeader: false,
    });
    expect(reversed.recipients).toEqual([{ name: "Sam", contact: "sam@example.com" }]);
  });

  it("does not infer headers or drop invalid mapped rows", () => {
    const noHeader = importInvitationSpreadsheet("Name\tEmail\nJane\ta@example.com", {
      contactColumn: 1,
      nameColumn: 0,
      hasHeader: false,
    });
    expect(noHeader.issues).toContainEqual({ code: "invalidContact", row: 0, column: 1 });
    expect(noHeader.text).toBe("");
    expect(noHeader.recipients).toEqual([]);
    const missing = importInvitationSpreadsheet("Jane\ta@example.com\nSam", {
      contactColumn: 1,
      nameColumn: 0,
      hasHeader: false,
    });
    expect(missing.issues).toContainEqual({ code: "missingCell", row: 1 });
  });

  it("allows empty optional names and ignored cells but preserves duplicate contacts", () => {
    const result = importInvitationSpreadsheet("\ta@example.com\n \tA@EXAMPLE.COM\n\t\n", {
      contactColumn: 1,
      nameColumn: 0,
      hasHeader: false,
    });
    expect(result.issues).toEqual([]);
    expect(result.recipients).toEqual([{ contact: "a@example.com" }, { contact: "a@example.com" }]);
    const ignoredName = importInvitationSpreadsheet("any\ta@example.com", {
      contactColumn: 1,
      hasHeader: false,
    });
    expect(ignoredName.recipients).toEqual([{ contact: "a@example.com" }]);
  });

  it.each([
    { contactColumn: -1, hasHeader: false },
    { contactColumn: 0.5, hasHeader: false },
    { contactColumn: 0, nameColumn: 0, hasHeader: false },
    { contactColumn: 32, hasHeader: false },
    { contactColumn: 0, nameColumn: -1, hasHeader: false },
  ])("rejects malformed mapping %j", (mapping) => {
    expect(importInvitationSpreadsheet("a@example.com", mapping).issues).toContainEqual({
      code: "invalidMapping",
    });
  });

  it("reports mapping outside the grid and quote corruption", () => {
    expect(
      importInvitationSpreadsheet("a@example.com", { contactColumn: 2, hasHeader: false }).issues
    ).toContainEqual({ code: "invalidMapping" });
    for (const text of [
      '"Jane\ta@example.com',
      'Ja"ne\ta@example.com',
      '"Jane"oops\ta@example.com',
    ]) {
      const result = importInvitationSpreadsheet(text, {
        contactColumn: 1,
        nameColumn: 0,
        hasHeader: false,
      });
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.text).toBe("");
    }
  });

  it("rejects control characters inside otherwise legal quoted name cells", () => {
    for (const name of ["A\nB", "A\tB", "\n"]) {
      const result = importInvitationSpreadsheet(`"${name}"\ta@example.com`, {
        contactColumn: 1,
        nameColumn: 0,
        hasHeader: false,
      });
      expect(result.issues).toContainEqual({ code: "invalidName", row: 0, column: 0 });
      expect(result.text).toBe("");
    }
  });

  it("bounds input, raw rows and columns", () => {
    expect(parseInvitationSpreadsheet("x".repeat(100_001)).issues[0].code).toBe("textTooLong");
    expect(parseInvitationSpreadsheet(Array(33).fill("x").join("\t")).issues[0].code).toBe(
      "tooManyColumns"
    );
    const noHeader = importInvitationSpreadsheet(Array(201).fill("a@example.com").join("\n"), {
      contactColumn: 0,
      hasHeader: false,
    });
    expect(noHeader.issues).toContainEqual({ code: "tooManyRows" });
    const withHeader = importInvitationSpreadsheet(
      "Email\n" + Array(200).fill("a@example.com").join("\n"),
      { contactColumn: 0, hasHeader: true }
    );
    expect(withHeader.recipients).toHaveLength(200);
    expect(withHeader.issues).toEqual([]);
    expect(parseInvitationSpreadsheet(Array(202).fill("x").join("\n")).issues).toContainEqual({
      code: "tooManyRows",
    });
  });
});
