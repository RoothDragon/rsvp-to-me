import { getRequestConfig } from "next-intl/server";
import { getRequestLocale } from "./server";
import { loadMessages } from "./catalogs";
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return { locale, messages: await loadMessages(locale) };
});
