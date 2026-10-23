import { describe, expect, it } from "vitest";
import { parseInvitationPaste } from "@/lib/invitation-paste";

const rows = (text: string) => parseInvitationPaste(text).rows;

describe("invitation paste parsing", () => {
  it.each([
    ["Alice Smith <alice@example.com>", "Alice Smith", "alice@example.com"],
    ['"Smith, Alice" <alice@example.com>', "Smith, Alice", "alice@example.com"],
    ["Alice Smith alice@example.com", "Alice Smith", "alice@example.com"],
    ["Alice Smith, alice@example.com", "Alice Smith", "alice@example.com"],
    ["alice@example.com, Alice Smith", "Alice Smith", "alice@example.com"],
    ["Alice Smith - alice@example.com", "Alice Smith", "alice@example.com"],
    ["Alice Smith (alice@example.com)", "Alice Smith", "alice@example.com"],
    ["Bob 555-0100", "Bob", "555-0100"],
    ["Bob +1 (555) 123-4567", "Bob", "+1 (555) 123-4567"],
    ["alice@example.com", "", "alice@example.com"],
    ['"A \\"B\\" C" <b@example.com>', 'A "B" C', "b@example.com"],
  ])("reads one recipient per line: %s", (text, name, contact) => {
    expect(rows(text)).toEqual([{ name, contact }]);
  });

  it("splits several contacts on a line at the separator after each contact", () => {
    expect(rows("Smith, Alice <a@example.com>; Jones, Bob <b@example.com>")).toEqual([
      { name: "Smith, Alice", contact: "a@example.com" },
      { name: "Jones, Bob", contact: "b@example.com" },
    ]);
    expect(rows("a@example.com, b@example.com;c@example.com")).toEqual([
      { name: "", contact: "a@example.com" },
      { name: "", contact: "b@example.com" },
      { name: "", contact: "c@example.com" },
    ]);
    expect(rows("Alice a@example.com, Bob b@example.com")).toEqual([
      { name: "Alice", contact: "a@example.com" },
      { name: "Bob", contact: "b@example.com" },
    ]);
    expect(rows("a@example.com Alice, b@example.com Bob")).toEqual([
      { name: "Alice", contact: "a@example.com" },
      { name: "Bob", contact: "b@example.com" },
    ]);
  });

  it("ends a recipient right after its contact when no separator comes before the next", () => {
    expect(rows("Alice <a@example.com> Bob <b@example.com>")).toEqual([
      { name: "Alice", contact: "a@example.com" },
      { name: "Bob", contact: "b@example.com" },
    ]);
  });

  it("handles CRLF, blank lines and quoted newlines", () => {
    expect(rows('Alice <a@example.com>\r\n\r\n"Multi\nLine" <b@example.com>\n')).toEqual([
      { name: "Alice", contact: "a@example.com" },
      { name: "Multi\nLine", contact: "b@example.com" },
    ]);
  });

  it("keeps contactless or invalid input as editable rows instead of dropping it", () => {
    expect(rows("Carol, Dave")).toEqual([
      { name: "Carol", contact: "" },
      { name: "Dave", contact: "" },
    ]);
    expect(rows("Erin <not-an-email>")).toEqual([{ name: "Erin", contact: "not-an-email" }]);
    expect(rows("Finn, finn@example")).toEqual([{ name: "Finn", contact: "finn@example" }]);
    expect(rows("Gus, 555-01")).toEqual([{ name: "Gus", contact: "555-01" }]);
  });

  it("always separates recipients at semicolons, even next to an invalid contact", () => {
    expect(rows("Smith, Carol <c@example.com>; Dee, not-an@email")).toEqual([
      { name: "Smith, Carol", contact: "c@example.com" },
      { name: "Dee", contact: "not-an@email" },
    ]);
  });

  it("does not let a missing closing bracket swallow the next line", () => {
    expect(rows("Jane <jane@example.com\nBob <b@example.com>")).toEqual([
      { name: "Jane", contact: "jane@example.com" },
      { name: "Bob", contact: "b@example.com" },
    ]);
  });

  it("ignores contacts inside quoted names and short digit runs in names", () => {
    expect(rows('"a@example.com" <b@example.com>')).toEqual([
      { name: "a@example.com", contact: "b@example.com" },
    ]);
    expect(rows("Table 12 Guest <c@example.com>")).toEqual([
      { name: "Table 12 Guest", contact: "c@example.com" },
    ]);
  });

  it("refuses text over the editor bound without parsing it", () => {
    expect(parseInvitationPaste("x".repeat(100_001))).toEqual({ rows: [], tooLong: true });
  });
});
