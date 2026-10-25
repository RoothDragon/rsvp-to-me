import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/session-user", () => ({ getSessionUser: vi.fn() }));
import { isLocale, resolveLocale, locales, menuLocales } from "@/i18n/config";
import { loadMessages } from "@/i18n/catalogs";
import { getTranslator } from "@/i18n/server";
describe("localization catalog", () => {
  it("only accepts registered own locale keys", () => {
    expect(isLocale("nl-NL")).toBe(true);
    expect(isLocale("de-DE")).toBe(true);
    expect(isLocale("es-ES")).toBe(true);
    for (const v of ["nl", "toString", "__proto__", null, {}, 1]) expect(isLocale(v)).toBe(false);
    expect(resolveLocale("unknown")).toBe("en-US");
  });
  it("orders the language menu with English first, then native names alphabetically", () => {
    const [first, ...rest] = menuLocales;
    const names = rest.map((locale) => locales[locale].nativeName);
    expect(first).toBe("en-US");
    expect([...menuLocales].sort()).toEqual(Object.keys(locales).sort());
    expect(names).toEqual(
      [...names].sort(new Intl.Collator("en", { sensitivity: "base" }).compare)
    );
  });
  it("loads native language metadata and Dutch messages", async () => {
    expect(locales["nl-NL"].nativeName).toBe("Nederlands");
    expect((await loadMessages("nl-NL")).Ui.Language.label).toBe("Taal");
  });
  it("creates an explicit translator without request context", async () => {
    expect((await getTranslator("nl-NL"))("Ui.Language.choose")).toBe("Taal kiezen");
  });
  it("loads German metadata and creates an explicit German translator", async () => {
    expect(locales["de-DE"].nativeName).toBe("Deutsch");
    expect((await loadMessages("de-DE")).Ui.Language.label).toBe("Sprache");
    expect((await getTranslator("de-DE"))("Ui.Language.choose")).toBe("Sprache wählen");
  });
  it("loads Spanish metadata and creates an explicit Spanish translator", async () => {
    expect(locales["es-ES"].nativeName).toBe("Español");
    expect((await loadMessages("es-ES")).Ui.Language.label).toBe("Idioma");
    expect((await getTranslator("es-ES"))("Ui.Language.choose")).toBe("Elegir idioma");
  });
});
