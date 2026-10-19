"use server";

import { eventActionMessage } from "./localization";

import { groupRecipientsByLocale } from "@/emails/recipients";
import { getTranslator } from "@/i18n/server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendBlastEmail } from "@/lib/email";
import { sendSmsBlast as smsSendBlast } from "@/lib/sms";
import { logSafe } from "@/lib/logger";
import { buildRsvpStatusFilter, type BlastStatusFilter } from "@/lib/blastFilters";
import { assertHostOrCohost } from "./shared";
import { assertCaptcha } from "@/lib/captcha";

// ── Message blast ──────────────────────────────────────────────────────────────

export async function sendBlast(
  eventId: string,
  message: string,
  filters: BlastStatusFilter[],
  captchaToken?: string | null
) {
  await assertHostOrCohost(eventId);
  await assertCaptcha("message_send", captchaToken);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      title: true,
      slug: true,
      theme: true,
      hostDisplayName: true,
      host: { select: { name: true, email: true } },
    },
  });
  if (!event) throw new Error(await eventActionMessage("eventNotFound"));

  const whereStatus = buildRsvpStatusFilter(filters);

  const CHUNK_SIZE = 500;
  let skip = 0;
  let totalSent = 0;

  while (true) {
    const rsvps = await db.rSVP.findMany({
      where: { eventId, guestEmail: { not: null }, ...whereStatus },
      select: { guestEmail: true, user: { select: { preferredLocale: true } } },
      take: CHUNK_SIZE,
      skip,
      orderBy: { id: "asc" },
    });

    if (rsvps.length === 0) break;

    const emails = rsvps.flatMap((r: { guestEmail: string | null }) =>
      r.guestEmail ? [r.guestEmail] : []
    );

    if (emails.length > 0) {
      for (const [locale, addresses] of groupRecipientsByLocale(
        rsvps.flatMap((r) =>
          r.guestEmail ? [{ address: r.guestEmail, preferredLocale: r.user?.preferredLocale }] : []
        )
      )) {
        const t = await getTranslator(locale);
        await sendBlastEmail(addresses, {
          locale,
          eventTitle: event.title,
          eventSlug: event.slug,
          message,
          hostName: event.hostDisplayName ?? event.host.name ?? t("Email.yourHost"),
          theme: event.theme,
          replyTo: event.host.email || undefined,
        });
      }
      totalSent += emails.length;

      await db.invitation
        .createMany({
          data: emails.map((sentTo) => ({ eventId, sentTo, channel: "EMAIL" as const })),
        })
        .catch(logSafe("sendBlast"));
    }

    if (rsvps.length < CHUNK_SIZE) break;
    skip += CHUNK_SIZE;
  }

  return { success: true, sent: totalSent };
}

export async function sendSmsBlast(
  eventId: string,
  message: string,
  filters: BlastStatusFilter[],
  captchaToken?: string | null
) {
  await assertHostOrCohost(eventId);
  await assertCaptcha("message_send", captchaToken);

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { title: true, slug: true, hostDisplayName: true, host: { select: { name: true } } },
  });
  if (!event) throw new Error(await eventActionMessage("eventNotFound"));

  const whereStatus = buildRsvpStatusFilter(filters);

  const CHUNK_SIZE = 500;
  let skip = 0;
  let totalSent = 0;

  while (true) {
    const rsvps = await db.rSVP.findMany({
      where: { eventId, guestPhone: { not: null }, ...whereStatus },
      select: { guestPhone: true, user: { select: { preferredLocale: true } } },
      take: CHUNK_SIZE,
      skip,
      orderBy: { id: "asc" },
    });

    if (rsvps.length === 0) break;

    const phones = rsvps.flatMap((r: { guestPhone: string | null }) =>
      r.guestPhone ? [r.guestPhone] : []
    );

    if (phones.length > 0) {
      let sent = 0;
      for (const [locale, addresses] of groupRecipientsByLocale(
        rsvps.flatMap((r) =>
          r.guestPhone ? [{ address: r.guestPhone, preferredLocale: r.user?.preferredLocale }] : []
        )
      )) {
        const t = await getTranslator(locale);
        sent += await smsSendBlast(addresses, {
          locale,
          eventTitle: event.title,
          eventSlug: event.slug,
          message,
          hostName: event.hostDisplayName ?? event.host.name ?? t("Email.yourHost"),
        });
      }
      totalSent += sent;

      await db.invitation
        .createMany({
          data: phones.map((sentTo) => ({ eventId, sentTo, channel: "SMS" as const })),
        })
        .catch(logSafe("sendSmsBlast"));
    }

    if (rsvps.length < CHUNK_SIZE) break;
    skip += CHUNK_SIZE;
  }

  return { success: true, sent: totalSent };
}

// ── Event updates ─────────────────────────────────────────────────────────────

export async function addEventUpdate(
  eventId: string,
  body: string,
  notifyGuests: boolean,
  captchaToken?: string | null
) {
  const event = await assertHostOrCohost(eventId);
  await assertCaptcha("event_update", captchaToken);
  const update = await db.eventUpdate.create({ data: { eventId, body, notifyGuests } });
  if (notifyGuests) {
    const rsvps = await db.rSVP.findMany({
      where: {
        eventId,
        OR: [{ guestEmail: { not: null } }, { guestPhone: { not: null } }],
      },
      select: {
        guestEmail: true,
        guestPhone: true,
        user: { select: { notificationChannel: true, preferredLocale: true } },
      },
    });

    const emailGuests: { address: string; preferredLocale?: string | null }[] = [];
    const smsGuests: { address: string; preferredLocale?: string | null }[] = [];

    for (const r of rsvps) {
      const channel = r.user?.notificationChannel ?? "EMAIL";
      if (channel === "SMS" && r.guestPhone) {
        smsGuests.push({ address: r.guestPhone, preferredLocale: r.user?.preferredLocale });
      } else if (r.guestEmail) {
        emailGuests.push({ address: r.guestEmail, preferredLocale: r.user?.preferredLocale });
      }
    }

    if (emailGuests.length > 0 || smsGuests.length > 0) {
      const fullEvent = await db.event.findUnique({
        where: { id: eventId },
        select: {
          title: true,
          theme: true,
          hostDisplayName: true,
          host: { select: { name: true, email: true } },
        },
      });
      const eventTitle = fullEvent?.title ?? event.slug;
      const hostName = fullEvent?.hostDisplayName ?? fullEvent?.host?.name;
      const replyTo = fullEvent?.host?.email || undefined;

      if (emailGuests.length > 0) {
        for (const [locale, addresses] of groupRecipientsByLocale(emailGuests)) {
          const t = await getTranslator(locale);
          sendBlastEmail(addresses, {
            locale,
            eventTitle,
            eventSlug: event.slug,
            message: body,
            hostName: hostName ?? t("Email.yourHost"),
            theme: fullEvent?.theme,
            replyTo,
          }).catch(logSafe("addEventUpdate"));
        }
      }
      if (smsGuests.length > 0) {
        for (const [locale, addresses] of groupRecipientsByLocale(smsGuests)) {
          const t = await getTranslator(locale);
          smsSendBlast(addresses, {
            locale,
            eventTitle,
            eventSlug: event.slug,
            message: body,
            hostName: hostName ?? t("Email.yourHost"),
          }).catch(logSafe("addEventUpdate"));
        }
      }
    }
  }
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: update.id, createdAt: update.createdAt };
}

export async function deleteEventUpdate(updateId: string) {
  const update = await db.eventUpdate.findUnique({
    where: { id: updateId },
    select: { eventId: true, event: { select: { slug: true } } },
  });
  if (!update) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(update.eventId);
  await db.eventUpdate.delete({ where: { id: updateId } });
  revalidatePath(`/e/${update.event.slug}`);
}
