import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE, type Locale } from "./config";
export const localeCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production" && process.env.DISABLE_HSTS !== "true",
};
export async function writeLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, localeCookieOptions);
}
/** Only call after successful LOGIN verification. */
export async function adoptLoginLocale(
  user: { id: string; preferredLocale?: string | null },
  browserValue: unknown
): Promise<Locale | null> {
  if (isLocale(user.preferredLocale)) return user.preferredLocale;
  if (user.preferredLocale != null || !isLocale(browserValue)) return null;
  await db.user.updateMany({
    where: { id: user.id, preferredLocale: null },
    data: { preferredLocale: browserValue },
  });
  const current = await db.user.findUnique({
    where: { id: user.id },
    select: { preferredLocale: true },
  });
  return isLocale(current?.preferredLocale) ? current.preferredLocale : null;
}
