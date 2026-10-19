import { groupRecipientsByLocale, resolveRecipientGroups } from "@/emails/recipients";
import { getTranslator } from "@/i18n/server";
import { db } from "./db";
import { sendBlastEmail } from "./email";
import { sendSmsBlast } from "./sms";
import { isRedisEnabled, redisAcquireLock, redisReleaseLock } from "./redis";
import { logSafe } from "./logger";

type ReminderType =
  | "email_week"
  | "email_day"
  | "email_hours"
  | "sms_week"
  | "sms_day"
  | "sms_hours"
  | "nudge_email"
  | "nudge_sms";

export async function processReminders(): Promise<void> {
  const jobName = "process_reminders";
  const now = new Date();
  const expireAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes lock expiry
  const lockKey = `lock:cron:${jobName}`;

  let hasRedisLock = false;

  if (isRedisEnabled()) {
    // Acquire Redis lock for 10 minutes (600 seconds)
    const acquired = await redisAcquireLock(lockKey, 600);
    if (!acquired) {
      console.log(
        "[cron-scheduler] Failed to acquire Redis lock (another instance is running). Skipping reminders check."
      );
      return;
    }
    hasRedisLock = true;
  } else {
    // Clean up stale database locks
    await db.cronLock
      .deleteMany({
        where: { expireAt: { lt: now } },
      })
      .catch(logSafe("reminders:stale-db-lock-cleanup"));

    try {
      await db.cronLock.create({
        data: { jobName, lockedAt: now, expireAt },
      });
    } catch {
      console.log(
        "[cron-scheduler] Failed to acquire database lock (another instance is running). Skipping reminders check."
      );
      return;
    }
  }

  try {
    // Clean up expired sessions during the cron run
    await db.session
      .deleteMany({
        where: { expiresAt: { lt: now } },
      })
      .catch(logSafe("reminders:expired-session-cleanup"));

    const events = await db.event.findMany({
      where: {
        status: { not: "CANCELLED" },
        startAt: { gt: now },
        reminderSettings: { isNot: null },
      },
      include: {
        reminderSettings: true,
        theme: true,
        host: { select: { name: true } },
        rsvps: {
          where: { approved: true },
          select: {
            guestEmail: true,
            guestPhone: true,
            status: true,
            user: {
              select: {
                emailNotifications: true,
                smsNotifications: true,
                preferredLocale: true,
              },
            },
          },
        },
        sentReminders: { select: { type: true } },
      },
    });

    for (const event of events) {
      const rs = event.reminderSettings!;
      const sent = new Set(event.sentReminders.map((r) => r.type));
      const startAt = event.startAt;

      const emails = event.rsvps.flatMap((r) => {
        if (!r.guestEmail) return [];
        if (r.user && !r.user.emailNotifications) return [];
        return [r.guestEmail];
      });
      const phones = event.rsvps.flatMap((r) => {
        if (!r.guestPhone) return [];
        if (r.user && !r.user.smsNotifications) return [];
        return [r.guestPhone];
      });
      const rsvpEmails = new Set(emails);
      const rsvpPhones = new Set(phones);

      // One marker per event/type is intentionally preserved. A failed later locale
      // group can cause accepted earlier groups to repeat on the next cron tick.
      const sendLocalized = async (type: ReminderType, addresses: string[], raw = false) => {
        const channel = type.startsWith("email") || type === "nudge_email" ? "email" : "phone";
        const groups = raw
          ? await resolveRecipientGroups(addresses, channel)
          : groupRecipientsByLocale(
              event.rsvps.flatMap((r) => {
                const address = channel === "email" ? r.guestEmail : r.guestPhone;
                if (!address || !addresses.includes(address)) return [];
                if (
                  r.user &&
                  !(channel === "email" ? r.user.emailNotifications : r.user.smsNotifications)
                )
                  return [];
                return [{ address, preferredLocale: r.user?.preferredLocale }];
              })
            );
        for (const [locale, recipients] of groups) {
          const t = await getTranslator(locale);
          const base = {
            locale,
            eventTitle: event.title,
            eventSlug: event.slug,
            hostName: event.hostDisplayName ?? event.host.name ?? t("Email.yourHost"),
            message: t(`Reminders.${type}`, {
              eventTitle: event.title,
              hours: rs.emailHoursBefore,
            }),
          };
          if (channel === "email")
            await sendBlastEmail(recipients, { ...base, theme: event.theme });
          else
            await sendSmsBlast(recipients, {
              ...base,
              message: t(`Reminders.${type}`, {
                eventTitle: event.title,
                hours: rs.smsHoursBefore,
              }),
            });
        }
      };

      const checks: Array<{
        type: ReminderType;
        enabled: boolean;
        dueAt: Date;
        send: () => Promise<unknown>;
      }> = [
        {
          type: "email_week",
          enabled: rs.emailWeekBefore && emails.length > 0,
          dueAt: new Date(startAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          send: () => sendLocalized("email_week", emails),
        },
        {
          type: "email_day",
          enabled: rs.emailDayBefore && emails.length > 0,
          dueAt: new Date(startAt.getTime() - 24 * 60 * 60 * 1000),
          send: () => sendLocalized("email_day", emails),
        },
        {
          type: "email_hours",
          enabled: rs.emailHoursBefore > 0 && emails.length > 0,
          dueAt: new Date(startAt.getTime() - rs.emailHoursBefore * 60 * 60 * 1000),
          send: () => sendLocalized("email_hours", emails),
        },
        {
          type: "sms_week",
          enabled: rs.smsWeekBefore && phones.length > 0,
          dueAt: new Date(startAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          send: () => sendLocalized("sms_week", phones),
        },
        {
          type: "sms_day",
          enabled: rs.smsDayBefore && phones.length > 0,
          dueAt: new Date(startAt.getTime() - 24 * 60 * 60 * 1000),
          send: () => sendLocalized("sms_day", phones),
        },
        {
          type: "sms_hours",
          enabled: rs.smsHoursBefore > 0 && phones.length > 0,
          dueAt: new Date(startAt.getTime() - rs.smsHoursBefore * 60 * 60 * 1000),
          send: () => sendLocalized("sms_hours", phones),
        },
        {
          type: "nudge_email",
          enabled: rs.nudgeUnresponded,
          dueAt: new Date(startAt.getTime() - 3 * 24 * 60 * 60 * 1000),
          send: async () => {
            const invitations = await db.invitation.findMany({
              where: { eventId: event.id, channel: "EMAIL" },
              select: { sentTo: true },
            });
            const nudgeEmails = [...new Set(invitations.map((i) => i.sentTo))].filter(
              (e) => !rsvpEmails.has(e)
            );
            if (nudgeEmails.length === 0) return;
            return sendLocalized("nudge_email", nudgeEmails, true);
          },
        },
        {
          type: "nudge_sms",
          enabled: rs.nudgeUnresponded,
          dueAt: new Date(startAt.getTime() - 3 * 24 * 60 * 60 * 1000),
          send: async () => {
            const invitations = await db.invitation.findMany({
              where: { eventId: event.id, channel: "SMS" },
              select: { sentTo: true },
            });
            const nudgePhones = [...new Set(invitations.map((i) => i.sentTo))].filter(
              (p) => !rsvpPhones.has(p)
            );
            if (nudgePhones.length === 0) return;
            return sendLocalized("nudge_sms", nudgePhones, true);
          },
        },
      ];

      for (const check of checks) {
        if (!check.enabled || sent.has(check.type) || now < check.dueAt) continue;

        try {
          await check.send();
          await db.sentReminder.create({ data: { eventId: event.id, type: check.type } });
          console.log(`[reminders] Sent ${check.type} for "${event.title}"`);
        } catch (err) {
          console.error(`[reminders] Failed ${check.type} for "${event.title}":`, err);
        }
      }
    }
  } finally {
    // Release the lock
    if (hasRedisLock) {
      await redisReleaseLock(lockKey).catch(logSafe("reminders:release-redis-lock"));
    } else {
      await db.cronLock.delete({ where: { jobName } }).catch(logSafe("reminders:release-db-lock"));
    }
  }
}
