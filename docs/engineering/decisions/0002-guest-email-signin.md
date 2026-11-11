# 0002: Unified email sign-in and guest registration

Status: Accepted

## Context

Ordinary sign-in silently skipped unknown email addresses to avoid account
enumeration. Public-event registration sent verification mail to new guests.
People entering through the home page therefore saw a misleading sent message
and could not continue without discovering a different entry point.

## Decision

Valid email sign-in prepares a GUEST account using an atomic upsert with an empty
update. Existing roles and preferences remain authoritative. New and existing
addresses follow the same magic-link delivery path and receive the same public
success response. Account preparation does not create a session, claim an RSVP,
or authorize access; the existing one-time LOGIN verification boundary performs
those steps. Host registration remains separately controlled. Existing-account
SMS sign-in is unchanged.

Preserve safe event return paths. Without one, verified guests return to the
public event list and organizers to their dashboard. The home route admits
authenticated guests so this default does not redirect them back to the dashboard.

## Consequences

Unverified account stubs can exist after an abandoned request or delivery failure.
Repeated requests reuse the account and preserve its role. Email ownership must
still be proved before session creation or invitation linking. Existing
CAPTCHA and rate-limit boundaries run before account preparation. CAPTCHA is
enabled only when both optional Turnstile keys are configured; documentation
must not imply that protection is active in an unconfigured deployment.
