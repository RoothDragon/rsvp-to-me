
"use client";

import { useState, type FormEvent } from "react";
import { requestVerifiedGuestLinkAction } from "@/app/actions/auth";
import {
  AppButton,
  AppCard,
  AppInput,
  FormField,
  InlineAlert,
} from "@/components/ui/AppPrimitives";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { APP_SHELL } from "@/lib/theme";

type RsvpStatus = "GOING" | "MAYBE" | "NO";

export function VerifiedRsvpGate({
  eventSlug,
  status,
}: {
  eventSlug: string;
  status: RsvpStatus;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { runWithCaptcha } = useCaptcha();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await runWithCaptcha("signin", (token) =>
        requestVerifiedGuestLinkAction(
          email,
          eventSlug,
          status,
          token
        )
      );

      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error ?? "Unable to send verification email.");
      }
    } catch {
      setError("Unable to complete verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "420px",
        margin: "48px auto",
        padding: "0 16px",
      }}
    >
      <AppCard style={{ padding: "32px" }}>
        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>
              📬
            </div>
            <h2
              style={{
                color: APP_SHELL.textPrimary,
                fontSize: "22px",
                marginBottom: "12px",
              }}
            >
              Check your email
            </h2>
            <p
              style={{
                color: APP_SHELL.textSecondary,
                lineHeight: 1.6,
              }}
            >
              We sent a verification link to <strong>{email}</strong>.
              Open it to continue your RSVP.
            </p>
            <p
              style={{
                color: APP_SHELL.textMuted,
                fontSize: "13px",
              }}
            >
              The link expires after 15 minutes.
            </p>
          </div>
        ) : (
          <>
            <h2
              style={{
                color: APP_SHELL.textPrimary,
                fontSize: "22px",
                marginBottom: "12px",
              }}
            >
              Verify your email to RSVP
            </h2>
            <p
              style={{
                color: APP_SHELL.textSecondary,
                lineHeight: 1.6,
                marginBottom: "24px",
              }}
            >
              This event requires verified contact information.
              Enter your email address and we&apos;ll send you a
              secure link to continue.
            </p>

            <form onSubmit={handleSubmit}>
              <FormField
                label="Email address"
                style={{ marginBottom: "20px" }}
              >
                <AppInput
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={100}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </FormField>

              {error && <InlineAlert>{error}</InlineAlert>}

              <AppButton
                type="submit"
                disabled={loading}
                style={{ width: "100%", padding: "13px" }}
              >
                {loading ? "Sending..." : "Send verification link"}
              </AppButton>
            </form>
          </>
        )}
      </AppCard>
    </div>
  );
}
