"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { resolveLocale, LOCALE_COOKIE } from "@/i18n/config";
import { getRequestTranslator } from "@/i18n/server";
import { createMagicLink, registerHost, isOpenRegistrationActive } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { sendMagicLinkSms } from "@/lib/sms";
import { SendMagicLinkSchema, RegisterHostSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { assertCaptcha } from "@/lib/captcha";
import { z } from "zod";

function looksLikePhone(s: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

export async function sendMagicLinkAction(
  rawIdentifier: string,
  redirect?: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  const t = await getRequestTranslator();
  // Validate input
  const parseResult = SendMagicLinkSchema.safeParse({ identifier: rawIdentifier });
  if (!parseResult.success) {
    return { success: false, error: t("Ui.Errors.Auth.invalidIdentifier") };
  }
  const identifier = parseResult.data.identifier;
  const isPhone = looksLikePhone(identifier);
  if (!isPhone && !z.string().email().max(100).safeParse(identifier).success) {
    return { success: false, error: t("Ui.Errors.Auth.invalidIdentifier") };
  }
  await assertCaptcha("signin", captchaToken);

  // SEC-45: only apply the per-IP limiter when a trusted proxy IP is configured.
  // Without one, getClientIp() collapses to loopback and this becomes a single
  // shared bucket across ALL clients — 20 sign-in attempts anywhere would lock
  // every user out. The per-identifier limiter below is the real protection in
  // that mode (as documented in lib/clientIp.ts); a proxy deployment sets
  // TRUSTED_IP_HEADER to restore per-client granularity.
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    const ipLimit = await rateLimit(`ip:${ip}:magic-link`, 20, 600);
    if (!ipLimit.success) {
      return {
        success: false,
        error: t("Ui.Errors.Auth.ipLimit"),
      };
    }
  }

  // Rate limit by identifier: max 5 per 10 minutes
  const idLimit = await rateLimit(`id:${identifier.toLowerCase()}:magic-link`, 5, 600);
  if (!idLimit.success) {
    return {
      success: false,
      error: t("Ui.Errors.Auth.identifierLimit"),
    };
  }

  // Email sign-in also registers guests. This creates no session and claims no
  // RSVP: those require opening the verified LOGIN link. Empty updates preserve
  // existing HOST/ADMIN roles and account preferences, including concurrent sends.
  if (!isPhone) {
    const email = identifier.toLowerCase().trim();
    await db.user.upsert({
      where: { email },
      create: { email, role: "GUEST" },
      update: {},
      select: { id: true },
    });
  }
  const link = await createMagicLink(identifier, redirect);

  // SEC-40: existing-account phone sign-in still uses the same public response
  // for an unknown phone. Valid emails above always get the same registration
  // and delivery path, without revealing whether an account already existed.
  if (!link) {
    return { success: true };
  }

  const recipient = await db.user.findUnique({
    where: isPhone
      ? { phone: identifier.trim().replace(/[\s\-().]/g, "") }
      : { email: identifier.toLowerCase().trim() },
    select: { preferredLocale: true },
  });
  const recipientLocale =
    recipient?.preferredLocale != null
      ? resolveLocale(recipient.preferredLocale)
      : resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  try {
    if (isPhone) {
      const phone = identifier.trim().replace(/[\s\-().]/g, "");
      await sendMagicLinkSms(phone, link, recipientLocale);
    } else {
      await sendMagicLinkEmail(identifier.toLowerCase().trim(), link, recipientLocale);
    }
  } catch (err) {
    console.error("[auth] Magic link delivery failed:", err);
    return { success: false, error: "auth_failed" };
  }

  return { success: true };
}

// A token selects the recipient; verification still requires opening a fresh
// magic link at the RSVP's current contact. Never accept a caller's destination.
export async function requestRsvpOwnerLinkAction(
  editToken: string,
  status: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  const invalid = { success: false, error: "Unable to verify this RSVP. Please contact the host." };
  if (
    !z.string().min(1).max(128).safeParse(editToken).success ||
    !["GOING", "MAYBE", "NO"].includes(status)
  )
    return invalid;
  await assertCaptcha("signin", captchaToken);
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    if (!(await rateLimit(`ip:${ip}:magic-link`, 20, 600)).success)
      return { success: false, error: "Too many requests. Please try later." };
  }
  const rsvp = await db.rSVP.findUnique({
    where: { editToken },
    include: {
      user: { select: { id: true, email: true, phone: true } },
      event: { select: { slug: true, status: true, startAt: true, requireVerifiedRsvp: true } },
    },
  });
  if (
    !rsvp ||
    !rsvp.event.requireVerifiedRsvp ||
    rsvp.event.status !== "PUBLISHED" ||
    rsvp.event.startAt <= new Date()
  )
    return invalid;

  const email = rsvp.guestEmail?.trim().toLowerCase();
  const phone = rsvp.guestPhone?.trim().replace(/[\s\-().]/g, "");
  // Existing ownership is authoritative; a stale/mismatched contact must not
  // send a link that could never authorize this response.
  const useEmail = !!email && (!rsvp.userId || rsvp.user?.email?.trim().toLowerCase() === email);
  const usePhone =
    !!phone && (!rsvp.userId || rsvp.user?.phone?.trim().replace(/[\s\-().]/g, "") === phone);
  const identifier = useEmail ? email : usePhone ? phone : undefined;
  if (!identifier) return invalid;
  if (!(await rateLimit(`id:${identifier}:magic-link`, 5, 600)).success)
    return { success: false, error: "Too many requests. Please try later." };

  const contact = useEmail ? { email: identifier } : { phone: identifier };
  const user = await db.user.upsert({
    where: contact,
    create: { ...contact, role: "GUEST" },
    update: {},
    select: { preferredLocale: true },
  });
  const query = new URLSearchParams({ token: editToken, status });
  const destination = `/e/${encodeURIComponent(rsvp.event.slug)}/rsvp?${query}`;
  const link = await createMagicLink(identifier, destination);
  if (!link) return invalid;
  const locale = resolveLocale(user.preferredLocale ?? (await cookies()).get(LOCALE_COOKIE)?.value);
  try {
    if (useEmail) await sendMagicLinkEmail(identifier, link, locale);
    else await sendMagicLinkSms(identifier, link, locale);
  } catch {
    return { success: false, error: "Unable to send a sign-in link. Please try again." };
  }
  return { success: true };
}

export async function registerHostAction(
  rawEmail: string,
  rawName: string,
  rawInviteCode: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  const t = await getRequestTranslator();
  // Validate input
  const parseResult = RegisterHostSchema.safeParse({
    email: rawEmail,
    name: rawName,
    inviteCode: rawInviteCode,
  });
  if (!parseResult.success) {
    return { success: false, error: t("Ui.Errors.Auth.invalidRegistration") };
  }

  const { email, name, inviteCode } = parseResult.data;
  await assertCaptcha("register", captchaToken);
  const ip = await getClientIp();

  // Rate limit registration by IP: max 3 per hour
  const ipLimit = await rateLimit(`ip:${ip}:register`, 3, 3600);
  if (!ipLimit.success) {
    return {
      success: false,
      error: t("Ui.Errors.Auth.registrationLimit"),
    };
  }

  const openReg = await isOpenRegistrationActive();
  if (!openReg && (!inviteCode || inviteCode.trim() === "")) {
    return { success: false, error: t("Ui.Errors.Auth.inviteRequired") };
  }

  const result = await registerHost(email, name, inviteCode ?? "");

  if (result.success) {
    const link = await createMagicLink(email);
    if (link) {
      const recipient = await db.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { preferredLocale: true },
      });
      const locale =
        recipient?.preferredLocale != null
          ? resolveLocale(recipient.preferredLocale)
          : resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
      await sendMagicLinkEmail(email, link, locale);
    }
  }

  return result;
}

/**
 * Request a magic link for a guest joining a verification-required event.
 *
 * Unlike HOST registration, this endpoint allows self-registration
 * without an invitation code, but never grants elevated privileges.
 */
export async function requestVerifiedGuestLinkAction(
  rawEmail: string,
  eventSlug: string,
  status: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  const parsed = z.string().trim().toLowerCase().email().max(100).safeParse(rawEmail);

  if (!parsed.success) {
    return { success: false, error: "Enter a valid email address." };
  }

  const email = parsed.data;
  const validStatuses = ["GOING", "MAYBE", "NO"] as const;

  if (!validStatuses.some((value) => value === status)) {
    return {
      success: false,
      error: "Invalid RSVP status.",
    };
  }

  await assertCaptcha("signin", captchaToken);

  // Allow this workflow only for eligible published events.
  const event = await db.event.findUnique({
    where: { slug: eventSlug },
    select: {
      slug: true,
      status: true,
      startAt: true,
      visibility: true,
      passwordHash: true,
      requireVerifiedRsvp: true,
    },
  });

  if (
    !event ||
    event.status !== "PUBLISHED" ||
    !event.requireVerifiedRsvp ||
    !["PUBLIC", "UNLISTED"].includes(event.visibility) ||
    event.passwordHash !== null ||
    event.startAt <= new Date()
  ) {
    return {
      success: false,
      error: "This event is not accepting verified guest registration.",
    };
  }

  // Preserve the same rate-limiting approach as normal sign-in.
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    const ipLimit = await rateLimit(`ip:${ip}:magic-link`, 20, 600);

    if (!ipLimit.success) {
      return { success: false, error: "Too many requests. Please try later." };
    }
  }

  const idLimit = await rateLimit(`id:${email}:magic-link`, 5, 600);

  if (!idLimit.success) {
    return { success: false, error: "Too many requests. Please try later." };
  }

  // Existing accounts retain their current roles.
  // New accounts always start as GUEST.
  const user = await db.user.upsert({
    where: { email },
    create: { email, role: "GUEST" },
    update: {},
    select: { preferredLocale: true },
  });

  const redirect = `/e/${encodeURIComponent(event.slug)}/rsvp?status=${status}`;
  const link = await createMagicLink(email, redirect);

  if (!link) {
    return { success: false, error: "Unable to create verification link." };
  }

  const locale = resolveLocale(user.preferredLocale ?? (await cookies()).get(LOCALE_COOKIE)?.value);

  try {
    await sendMagicLinkEmail(email, link, locale);
  } catch (err) {
    console.error("[verified-guest] Magic link delivery failed:", err);
    return { success: false, error: "Unable to send verification email." };
  }

  return { success: true };
}
