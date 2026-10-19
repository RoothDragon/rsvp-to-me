import type messages from "@/messages/en-US.json";
type EventActionMessageKey = keyof typeof messages.Ui.Errors.EventActions;
import { getRequestTranslator } from "@/i18n/server";
import type { TranslationValues } from "next-intl";
/** Resolve request language lazily on a visible failure, never recipient copy. */
export async function eventActionMessage(key: EventActionMessageKey, values?: TranslationValues) {
  const t = await getRequestTranslator();
  return t(`Ui.Errors.EventActions.${key}`, values);
}
