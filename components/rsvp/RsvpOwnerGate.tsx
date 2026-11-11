"use client";

import { useState } from "react";
import { requestRsvpOwnerLinkAction } from "@/app/actions/auth";
import { AppButton, AppCard, InlineAlert } from "@/components/ui/AppPrimitives";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

export function RsvpOwnerGate({
  editToken,
  status,
}: {
  editToken: string;
  status: "GOING" | "MAYBE" | "NO";
}) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { runWithCaptcha } = useCaptcha();

  async function verify() {
    setPending(true);
    setError(null);
    try {
      const result = await runWithCaptcha("signin", (captcha) =>
        requestRsvpOwnerLinkAction(editToken, status, captcha)
      );
      if (result.success) setSent(true);
      else setError(result.error ?? "Unable to send a sign-in link.");
    } catch {
      setError("Unable to send a sign-in link. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "48px auto", padding: "0 16px" }}>
      <AppCard style={{ padding: 32 }}>
        <h2>{sent ? "Check your email or phone" : "Verify before responding"}</h2>
        <p>
          {sent
            ? "Open the sign-in link sent to the contact on this RSVP to continue your response. The link expires after 15 minutes."
            : "This event requires verification. Send a sign-in link to the email address or phone number on this RSVP before answering the questions. If you cannot access that contact, ask the host for help."}
        </p>
        {error && <InlineAlert>{error}</InlineAlert>}
        {!sent && (
          <AppButton disabled={pending} onClick={verify}>
            {pending ? "Sending..." : "Send sign-in link"}
          </AppButton>
        )}
      </AppCard>
    </div>
  );
}
