import manifest from "@/messages/locales.json";
export type Locale = keyof typeof manifest;
export const DEFAULT_LOCALE: Locale = "en-US";
export const LOCALE_COOKIE = "rsvp-locale";
export const locales = manifest as Record<
  Locale,
  { nativeName: string; dir: "ltr" | "rtl"; flag: string }
>;
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(locales, value);
}
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
