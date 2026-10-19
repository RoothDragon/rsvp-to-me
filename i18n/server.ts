import { cache } from "react";
import { cookies } from "next/headers";
import { createTranslator } from "next-intl";
import { getSessionUser } from "@/lib/session-user";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { loadMessages } from "./catalogs";
export const getRequestLocale = cache(async (): Promise<Locale> => {
  const user = await getSessionUser();
  if (isLocale(user?.preferredLocale)) return user.preferredLocale;
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});
export async function getTranslator(locale: Locale) {
  return createTranslator({ locale, messages: await loadMessages(locale) });
}
export async function getRequestTranslator() {
  return getTranslator(await getRequestLocale());
}
