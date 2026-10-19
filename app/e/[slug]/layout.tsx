import { getRequestLocale, getRequestTranslator } from "@/i18n/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildEventSocialMetadata } from "@/lib/event-social";
import { CaptchaProvider } from "@/components/ui/CaptchaProvider";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { getSessionUser } from "@/lib/session-user";
import { headers } from "next/headers";

type EventSlugLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(props: EventSlugLayoutProps): Promise<Metadata> {
  const { slug } = await props.params;

  // Page metadata replaces this for viewable events. Keeping a privacy-safe
  // segment default prevents Next's not-found boundary from falling back to
  // site-wide metadata for missing and cancelled event URLs.
  const [locale, translate] = await Promise.all([getRequestLocale(), getRequestTranslator()]);
  return buildEventSocialMetadata(null, slug, {
    locale,
    translate: (key, values) => translate(`Ui.Event.Social.${key}`, values),
  });
}

export default async function EventSlugLayout({ children }: EventSlugLayoutProps) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const sessionUser = await getSessionUser();
  return (
    <CaptchaProvider
      siteKey={getCaptchaSiteKey()}
      bypass={sessionUser?.role === "ADMIN"}
      nonce={nonce}
    >
      {children}
    </CaptchaProvider>
  );
}
