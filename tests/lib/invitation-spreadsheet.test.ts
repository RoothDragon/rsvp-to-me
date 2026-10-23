import { describe, expect, it } from "vitest";
import {
  detectInvitationDelimiter,
  importInvitationSpreadsheet,
  parseInvitationSpreadsheet,
  suggestInvitationSpreadsheetMapping,
} from "@/lib/invitation-spreadsheet";

const grid = (text: string) => parseInvitationSpreadsheet(text, detectInvitationDelimiter(text));

describe("invitation spreadsheet parsing", () => {
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

  it("detects tab, comma and semicolon files and strips a byte-order mark", () => {
    expect(detectInvitationDelimiter("a\tb,c")).toBe("\t");
    expect(detectInvitationDelimiter('"x;y",b,c')).toBe(",");
    expect(detectInvitationDelimiter("Name;Email\nA;a@example.com")).toBe(";");
    expect(grid('﻿Name,Email\n"Doe, Jane",jane@example.com').rows).toEqual([
      ["Name", "Email"],
      ["Doe, Jane", "jane@example.com"],
    ]);
  });

  it("reports quote corruption", () => {
    for (const text of ['"Jane\ta@example.com', 'Ja"ne\ta@example.com', '"Jane"oops\ta']) {
      expect(parseInvitationSpreadsheet(text).issues.length).toBeGreaterThan(0);
    }
  });

  it("bounds input, raw rows and columns for contact-app exports", () => {
    expect(parseInvitationSpreadsheet("x".repeat(2_000_001)).issues[0].code).toBe("textTooLong");
    expect(parseInvitationSpreadsheet(Array(255).fill("x").join(",") + "\n", ",").issues).toEqual(
      []
    );
    expect(parseInvitationSpreadsheet(Array(257).fill("x").join(","), ",").issues[0].code).toBe(
      "tooManyColumns"
    );
    expect(parseInvitationSpreadsheet(Array(202).fill("x").join("\n")).issues).toContainEqual({
      code: "tooManyRows",
    });
  });
});

describe("invitation spreadsheet mapping suggestions", () => {
  it("maps a simple Name/Email header", () => {
    expect(
      suggestInvitationSpreadsheetMapping(grid("Name,Email\nJane,jane@example.com").rows)
    ).toEqual({ hasHeader: true, nameColumns: [0], contactColumns: [1] });
  });

  it("maps Google Contacts exports: first/middle/last names, email then phone", () => {
    const text = [
      "First Name,Middle Name,Last Name,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value",
      "Jane,,Doe,* Home,jane@example.com,Mobile,+1 555 123 4567",
      "Sam,Q,Lee,,,Mobile,(555) 222-1234",
    ].join("\n");
    expect(suggestInvitationSpreadsheetMapping(grid(text).rows)).toEqual({
      hasHeader: true,
      nameColumns: [0, 1, 2],
      contactColumns: [4, 6],
    });
  });

  it("sniffs columns from values when there is no header", () => {
    const rows = grid("jane@example.com,Jane Doe,2026-10-23\nsam@example.com,Sam,2026-10-24").rows;
    expect(suggestInvitationSpreadsheetMapping(rows)).toEqual({
      hasHeader: false,
      nameColumns: [1],
      contactColumns: [0],
    });
  });
});

describe("invitation spreadsheet import", () => {
  it("joins name columns and falls back from email to phone per row", () => {
    const { rows } = grid(
      "First,Last,Email,Mobile\nJane,Doe,jane@example.com,555-123-4567\nSam,,,555-222-1234\n,,,\n"
    );
    expect(
      importInvitationSpreadsheet(rows, {
        hasHeader: true,
        nameColumns: [0, 1],
        contactColumns: [2, 3],
      })
    ).toEqual({
      recipients: [
        { name: "Jane Doe", contact: "jane@example.com" },
        { name: "Sam", contact: "555-222-1234" },
      ],
      issues: [],
    });
  });

  it("keeps invalid or missing contacts as rows for the host to fix", () => {
    const { rows } = grid("Jane,not-an-email\nSam,\n");
    expect(
      importInvitationSpreadsheet(rows, { hasHeader: false, nameColumns: [0], contactColumns: [1] })
        .recipients
    ).toEqual([
      { name: "Jane", contact: "not-an-email" },
      { name: "Sam", contact: "" },
    ]);
  });

  it.each([
    { hasHeader: false, nameColumns: [], contactColumns: [] },
    { hasHeader: false, nameColumns: [0], contactColumns: [0] },
    { hasHeader: false, nameColumns: [], contactColumns: [2] },
    { hasHeader: false, nameColumns: [], contactColumns: [0.5] },
    { hasHeader: false, nameColumns: [0, 0], contactColumns: [1] },
    { hasHeader: false, nameColumns: [], contactColumns: [0, 1, 1] },
  ])("rejects malformed mapping %j", (mapping) => {
    expect(importInvitationSpreadsheet([["a", "b@example.com"]], mapping).issues).toEqual([
      { code: "invalidMapping" },
    ]);
  });

  it("refuses more than 200 recipients after the header", () => {
    const rows = [["Email"], ...Array.from({ length: 200 }, (_, i) => [`g${i}@example.com`])];
    const mapping = { hasHeader: true, nameColumns: [], contactColumns: [0] };
    expect(importInvitationSpreadsheet(rows, mapping).recipients).toHaveLength(200);
    expect(importInvitationSpreadsheet([...rows, ["extra@example.com"]], mapping).issues).toEqual([
      { code: "tooManyRows" },
    ]);
  });
});
