import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/session-user", () => ({ getSessionUser: vi.fn() }));
import { isLocale, resolveLocale, locales } from "@/i18n/config";
import { loadMessages } from "@/i18n/catalogs";
import { getTranslator } from "@/i18n/server";
describe("localization catalog", () => {
  it("only accepts registered own locale keys", () => {
    expect(isLocale("nl-NL")).toBe(true);
    for (const v of ["nl", "toString", "__proto__", null, {}, 1]) expect(isLocale(v)).toBe(false);
    expect(resolveLocale("unknown")).toBe("en-US");
  });
  it("loads native language metadata and Dutch messages", async () => {
    expect(locales["nl-NL"].nativeName).toBe("Nederlands");
    expect((await loadMessages("nl-NL")).Ui.Language.label).toBe("Taal");
  });
  it("creates an explicit translator without request context", async () => {
    expect((await getTranslator("nl-NL"))("Ui.Language.choose")).toBe("Taal kiezen");
  });
});
