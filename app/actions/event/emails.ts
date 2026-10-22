"use server";

import { eventActionMessage } from "./localization";

import { createElement } from "react";
import { getRequestLocale, getTranslator } from "@/i18n/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { resolveEmailTheme } from "@/lib/email-theme";
import { getEmailTemplateSettings, mergeWithDefaults } from "@/lib/email-settings";
import { renderEmail, substitutePlaceholders } from "@/emails/render";
import { getEmailTemplateMeta, mergedToggles, type TemplateId } from "@/emails/registry";
import type { EventEmailDetails } from "@/emails/components/DetailsCard";
import { InviteEmail } from "@/emails/templates/InviteEmail";
import { RsvpConfirmationEmail } from "@/emails/templates/RsvpConfirmationEmail";
import { ApprovalEmail } from "@/emails/templates/ApprovalEmail";
import { BlastEmail } from "@/emails/templates/BlastEmail";
import { HostRsvpAlertEmail } from "@/emails/templates/HostRsvpAlertEmail";
import { formatEventDateTime } from "@/lib/calendar";
import { sendRenderedEmail } from "@/lib/email";
import { assertHostOrCohost } from "./shared";
import { assertCaptcha } from "@/lib/captcha";
import { isValidInvitationName } from "@/lib/invitation-draft";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Templates a host can preview for their event. */
const EVENT_TEMPLATE_IDS: TemplateId[] = [
  "invite",
  "rsvpConfirmation",
  "approval",
  "blast",
  "hostRsvpAlert",
];

const SAMPLE_GUEST = "Alex Sample";

async function renderEventEmail(eventId: string, templateId: TemplateId, guestName?: string) {
  if (!EVENT_TEMPLATE_IDS.includes(templateId)) {
    throw new Error(await eventActionMessage("unknownTemplate"));
  }
  await assertHostOrCohost(eventId);
  if (
    guestName !== undefined &&
    (templateId !== "invite" || typeof guestName !== "string" || !isValidInvitationName(guestName))
  ) {
    throw new Error(await eventActionMessage("invalidInvitationRecipients"));
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { theme: true, host: { select: { name: true, email: true } } },
  });
  if (!event) throw new Error(await eventActionMessage("forbidden"));

  const locale = await getRequestLocale();
  const t = await getTranslator(locale);

  // Real event data + the event's real current theme, with a sample guest.
  const theme = resolveEmailTheme(event.theme);
  const hostName =
    event.hostDisplayName ??
    event.host.name ??
    event.host.email?.split("@")[0] ??
    t("Email.yourHostCapital");
  const eventUrl = `${APP_URL}/e/${event.slug}`;
  const details: EventEmailDetails = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    locationType: event.locationType,
    locationName: event.locationName,
    locationAddress: event.locationAddress,
    virtualUrl: event.virtualUrl,
  };

  const overrides = await getEmailTemplateSettings(templateId);
  const toggles = mergedToggles(templateId, overrides);
  const vars: Record<string, string> = {
    guestName: templateId === "invite" && guestName !== undefined ? guestName.trim() : SAMPLE_GUEST,
    hostName,
    eventTitle: event.title,
    eventDate: formatEventDateTime(event.startAt, event.endAt, event.timezone, locale).date,
    location: event.locationName ?? "",
    status: t("Email.status.GOING"),
    decision: t("Email.decision.approved"),
  };
  const merged = mergeWithDefaults(templateId, overrides, t, vars);
  const subject = overrides.subject
    ? substitutePlaceholders(overrides.subject, vars)
    : merged.subject;
  const body = overrides.body ? substitutePlaceholders(merged.body, vars) : merged.body;

  let element: React.ReactElement;
  switch (templateId) {
    case "invite":
      element = createElement(InviteEmail, {
        theme,
        body,
        toggles,
        event: details,
        hostName,
        rsvpBaseUrl: `${eventUrl}/rsvp?token=sample-token`,
        maybeEnabled: event.maybeEnabled,
        eventUrl,
      });
      break;
    case "rsvpConfirmation":
      element = createElement(RsvpConfirmationEmail, {
        theme,
        body,
        toggles,
        event: details,
        status: "GOING",
        eventUrl,
        editUrl: `${eventUrl}/rsvp?token=sample-token`,
      });
      break;
    case "approval":
      element = createElement(ApprovalEmail, {
        theme,
        toggles,
        eventTitle: event.title,
        approved: true,
        hostMessage: t("Email.sample.hostMessage"),
        eventUrl,
      });
      break;
    case "blast":
      element = createElement(BlastEmail, {
        theme,
        toggles,
        eventTitle: event.title,
        hostName,
        message: t("Email.sample.eventBlast"),
        eventUrl,
      });
      break;
    default:
      element = createElement(HostRsvpAlertEmail, {
        theme,
        guestName: SAMPLE_GUEST,
        status: "GOING",
        plusOneCount: 1,
        note: t("Email.sample.note"),
        eventTitle: event.title,
        goingCount: 12,
        maybeCount: 3,
        noCount: 2,
        guestListUrl: `${eventUrl}#guests`,
      });
  }

  const { html, text } = await renderEmail(element, locale);
  return { subject, html, text };
}

/** Server-rendered preview for the event settings Emails panel. */
export async function getEventEmailPreview(
  eventId: string,
  templateId: TemplateId,
  guestName?: string
) {
  const { subject, html } = await renderEventEmail(eventId, templateId, guestName);
  return { subject, html };
}

/** Send a sample of an event email to the signed-in host/co-host. */
export async function sendEventEmailTest(
  eventId: string,
  templateId: TemplateId,
  captchaToken?: string | null
) {
  const session = await getSession();
  if (!session?.email) {
    return { success: false as const, error: await eventActionMessage("accountNoEmail") };
  }
  await assertCaptcha("email_test", captchaToken);
  const limit = await rateLimit(`event-email-test:${session.userId}`, 10, 3600);
  if (!limit.success) {
    return { success: false as const, error: await eventActionMessage("testEmailRateLimited") };
  }
  const { subject, html, text } = await renderEventEmail(eventId, templateId);
  // Send the real subject (no prefix) so the host previews exactly what guests
  // receive; it goes only to the signed-in host's own inbox.
  await sendRenderedEmail({ to: session.email, subject, html, text });
  return { success: true as const, sentTo: session.email };
}

/** Metadata for the event settings Emails panel dropdown. */
export async function getEventEmailTemplates() {
  const meta = getEmailTemplateMeta(await getTranslator(await getRequestLocale()));
  return EVENT_TEMPLATE_IDS.map((id) => ({
    id,
    label: meta[id].label,
    description: meta[id].description,
  }));
}
