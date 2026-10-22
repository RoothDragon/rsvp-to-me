import type { InvitationRecipient } from "./invitation-draft";

export type InvitationDisposition = "new" | "invited" | "responded" | "conflict";

export interface InvitationPreviewRecipient {
  contact: string;
  guestName: string;
  disposition: InvitationDisposition;
  channel: "EMAIL" | "SMS";
}

export interface ReviewedInvitationRecipient extends InvitationRecipient {
  expectedDisposition: Exclude<InvitationDisposition, "conflict">;
  expectedGuestName: string;
}

export interface InvitationSendResult {
  success: boolean;
  results: {
    contact: string;
    status: "sent" | "failed";
    guestName?: string;
    error?: string;
  }[];
}
