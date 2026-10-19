import english from "@/messages/en-US.json";
import type { Locale } from "./config";
export type Messages = typeof english;
type Catalog = { [key: string]: string | Catalog };
function merge(base: Catalog, overlay: Catalog): Catalog {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) continue;
    result[key] =
      typeof value === "object" && typeof result[key] === "object"
        ? merge(result[key] as Catalog, value)
        : value;
  }
  return result;
}
export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === "en-US") return english;
  const selected = (await import(`../messages/${locale}.json`)).default as Catalog;
  return merge(english, selected) as Messages;
}
