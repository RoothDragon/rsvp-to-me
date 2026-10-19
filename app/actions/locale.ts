"use server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isLocale } from "@/i18n/config";
import { writeLocaleCookie } from "@/i18n/preferences";
export async function setPreferredLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) throw new Error("Unsupported locale");
  const session = await getSession();
  if (session)
    await db.user.update({ where: { id: session.userId }, data: { preferredLocale: locale } });
  await writeLocaleCookie(locale);
}
