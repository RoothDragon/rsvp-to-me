import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  isValidInvitationName,
  MAX_INVITATION_RECIPIENTS,
  normalizeInvitationContact,
  type InvitationRecipient,
} from "./invitation-draft";
import type { InvitationPreviewRecipient, ReviewedInvitationRecipient } from "./invitation-types";

export class InvitationStateError extends Error {
  constructor(
    public readonly code:
      "invitationConflict" | "invitationReviewChanged" | "invitationChannelDisabled"
  ) {
    super(code);
  }
}

/** Runtime validation is deliberately strict: preview metadata never becomes write authority. */
export function validateInvitationRecipients(raw: unknown): InvitationRecipient[];
export function validateInvitationRecipients(
  raw: unknown,
  reviewed: true
): ReviewedInvitationRecipient[];
export function validateInvitationRecipients(
  raw: unknown,
  reviewed = false
): InvitationRecipient[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_INVITATION_RECIPIENTS) {
    throw new Error("Invalid invitation recipients");
  }
  const keys = new Set<string>();
  return raw.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid invitation recipient");
    const item = value as Record<string, unknown>;
    const allowed = reviewed
      ? ["contact", "name", "expectedDisposition", "expectedGuestName"]
      : ["contact", "name"];
    if (
      Object.keys(item).some((key) => !allowed.includes(key)) ||
      typeof item.contact !== "string"
    ) {
      throw new Error("Invalid invitation recipient");
    }
    const contact = normalizeInvitationContact(item.contact);
    if (!contact || keys.has(contact)) throw new Error("Invalid or duplicate invitation contact");
    keys.add(contact);
    if (
      item.name !== undefined &&
      (typeof item.name !== "string" || !isValidInvitationName(item.name))
    ) {
      throw new Error("Invalid invitation name");
    }
    const recipient: InvitationRecipient = {
      contact,
      ...(typeof item.name === "string" ? { name: item.name.trim() } : {}),
    };
    if (!reviewed) return recipient;
    if (
      (item.expectedDisposition !== "new" &&
        item.expectedDisposition !== "invited" &&
        item.expectedDisposition !== "responded") ||
      typeof item.expectedGuestName !== "string" ||
      item.expectedGuestName.length > 4096
    ) {
      throw new Error("Invalid invitation review");
    }
    return {
      ...recipient,
      expectedDisposition: item.expectedDisposition,
      expectedGuestName: item.expectedGuestName,
    };
  });
}

const rsvpSelection = {
  id: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  status: true,
  responded: true,
} as const;

export async function resolveInvitationRecipients(
  eventId: string,
  recipients: InvitationRecipient[],
  unnamedGuest: string,
  client: Pick<Prisma.TransactionClient, "rSVP" | "invitation"> = db
) {
  // Historical contacts can have case/punctuation variants. Read only the event's
  // small contact projection, not its Event graph or any account/profile data.
  const [rsvps, invitations] = await Promise.all([
    client.rSVP.findMany({ where: { eventId }, select: rsvpSelection }),
    client.invitation.findMany({
      where: { eventId },
      select: { id: true, sentTo: true, rsvpId: true },
    }),
  ]);
  const byId = new Map(rsvps.map((rsvp) => [rsvp.id, rsvp]));
  return recipients.map((recipient) => {
    const isEmail = recipient.contact.includes("@");
    const contactMatches = (rsvp: (typeof rsvps)[number]) => {
      const contact = isEmail ? rsvp.guestEmail : rsvp.guestPhone;
      return contact !== null && normalizeInvitationContact(contact) === recipient.contact;
    };
    const matchingInvitations = invitations.filter(
      (invite) => normalizeInvitationContact(invite.sentTo) === recipient.contact
    );
    const matches = new Map(rsvps.filter(contactMatches).map((rsvp) => [rsvp.id, rsvp]));
    let unsafeHistoryLink = false;
    for (const invite of matchingInvitations) {
      if (invite.rsvpId === null) continue;
      const linked = byId.get(invite.rsvpId);
      // Delivery history never grants a former contact the current guest's edit token.
      if (!linked || !contactMatches(linked)) unsafeHistoryLink = true;
    }
    const rsvp = matches.size === 1 ? [...matches.values()][0] : undefined;
    const disposition: InvitationPreviewRecipient["disposition"] =
      unsafeHistoryLink || matches.size > 1
        ? "conflict"
        : rsvp
          ? rsvp.responded || rsvp.status !== "INVITED"
            ? "responded"
            : "invited"
          : matchingInvitations.length > 0
            ? "invited"
            : "new";
    const preview: InvitationPreviewRecipient = {
      contact: recipient.contact,
      guestName: rsvp?.guestName ?? recipient.name ?? unnamedGuest,
      disposition,
      channel: recipient.contact.includes("@") ? "EMAIL" : "SMS",
    };
    return { preview, rsvp, invitationIds: matchingInvitations.map((invite) => invite.id) };
  });
}

export type ResolvedInvitationRecipient = Awaited<
  ReturnType<typeof resolveInvitationRecipients>
>[number];
