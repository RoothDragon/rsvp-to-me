import type { Locale } from "@/i18n/config";
import type { getTranslator } from "@/i18n/server";

export type NotificationTranslator = Awaited<ReturnType<typeof getTranslator>>;
export type EmailI18n = { locale: Locale; t: NotificationTranslator };
export type EmailI18nProps = { i18n?: EmailI18n };
/** The static renderer supplies explicit copy context; no React/client context. */
export function requireEmailI18n(i18n: EmailI18n | undefined): EmailI18n {
  if (!i18n)
    throw new Error("Email templates must be rendered with renderEmail or buildSampleEmail");
  return i18n;
}
