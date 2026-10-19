import { getRequestLocale, getRequestTranslator } from "@/i18n/server";
import { SOCIAL_IMAGE_SIZE } from "@/lib/event-social";
import { renderEventSocialImage } from "./social-image";

export const alt = "Event invitation on RSVP to Me";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OpenGraphImage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const [locale, translate] = await Promise.all([getRequestLocale(), getRequestTranslator()]);
  return renderEventSocialImage(slug, {
    locale,
    translate: (key, values) => translate(`Ui.Event.Social.${key}`, values),
  });
}
