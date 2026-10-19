import { convert } from "html-to-text";
import { cloneElement, type ReactElement } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getTranslator } from "@/i18n/server";
import type { EmailI18nProps } from "./i18n";

/** Render a template to both HTML and a plain-text alternative part. */
export async function renderEmail(
  element: ReactElement,
  locale?: Locale
): Promise<{ html: string; text: string }> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const root = element as ReactElement<EmailI18nProps>;
  const selectedLocale = locale ?? root.props.i18n?.locale ?? DEFAULT_LOCALE;
  const t =
    root.props.i18n?.locale === selectedLocale
      ? root.props.i18n.t
      : await getTranslator(selectedLocale);
  const rawHtml = renderToStaticMarkup(cloneElement(root, { i18n: { locale: selectedLocale, t } }));
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${rawHtml}`;

  const text = convert(rawHtml, {
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
    ],
  });

  return { html, text };
}

/**
 * Replace `{name}` placeholders with values. Unknown placeholders are left
 * literal so a typo is visible instead of silently vanishing. The result is
 * only ever rendered as React text nodes — never as HTML — so user-provided
 * copy cannot inject markup.
 */
export function substitutePlaceholders(
  template: string,
  vars: Record<string, string | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

/** Split editable body copy into paragraphs on blank/newline boundaries. */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
