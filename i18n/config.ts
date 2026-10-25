import manifest from "@/messages/locales.json";
export type Locale = keyof typeof manifest;
export const DEFAULT_LOCALE: Locale = "en-US";
export const LOCALE_COOKIE = "rsvp-locale";
export const locales = manifest as Record<
  Locale,
  { nativeName: string; dir: "ltr" | "rtl"; flag: string }
>;
// Language menu order: English first, then native names alphabetically, whatever the file order.
const menuCollator = new Intl.Collator("en", { sensitivity: "base" });
export const menuLocales: Locale[] = [
  DEFAULT_LOCALE,
  ...(Object.keys(locales) as Locale[])
    .filter((locale) => locale !== DEFAULT_LOCALE)
    .sort((a, b) => menuCollator.compare(locales[a].nativeName, locales[b].nativeName)),
];
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(locales, value);
}
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
