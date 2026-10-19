import { render as testingRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import english from "@/messages/en-US.json";
import type { Locale } from "@/i18n/config";
import type { ReactElement, ReactNode } from "react";
export * from "@testing-library/react";
export function render(
  ui: ReactElement,
  options: RenderOptions & { locale?: Locale; messages?: AbstractIntlMessages } = {}
) {
  const { locale = "en-US", messages = english, wrapper: CallerWrapper, ...rest } = options;
  function IntlWrapper({ children }: { children: ReactNode }) {
    const content = CallerWrapper ? <CallerWrapper>{children}</CallerWrapper> : children;
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {content}
      </NextIntlClientProvider>
    );
  }
  return testingRender(ui, { ...rest, wrapper: IntlWrapper });
}
