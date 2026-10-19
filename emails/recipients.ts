import { db } from "@/lib/db";
import { resolveLocale, type Locale } from "@/i18n/config";

/** Preserve destination order/duplicates and group only the rendering language. */
export function groupRecipientsByLocale(
  recipients: { address: string; preferredLocale?: string | null }[]
) {
  const groups = new Map<Locale, string[]>();
  for (const recipient of recipients) {
    const locale = resolveLocale(recipient.preferredLocale);
    const addresses = groups.get(locale) ?? [];
    addresses.push(recipient.address);
    groups.set(locale, addresses);
  }
  return groups;
}

/** Raw invitation destinations may not have accounts; resolve them in one query. */
export async function resolveRecipientGroups(addresses: string[], channel: "email" | "phone") {
  if (!addresses.length) return new Map<Locale, string[]>();
  const users = await db.user.findMany({
    where: channel === "email" ? { email: { in: addresses } } : { phone: { in: addresses } },
    select: { email: true, phone: true, preferredLocale: true },
  });
  const locales = new Map(users.map((user) => [user[channel], user.preferredLocale]));
  return groupRecipientsByLocale(
    addresses.map((address) => ({ address, preferredLocale: locales.get(address) }))
  );
}
