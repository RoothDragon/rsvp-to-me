# 0001: Invitation recipient identity

Status: Accepted

Related issue: #749

## Context

An invitation contains a private RSVP edit token. Historical delivery records
can outlive their original contact association, and concurrent invitation
requests can otherwise create multiple RSVPs for one event contact.

## Decision

Resolve recipients using current RSVP contacts within the selected event.
A linked invitation history row is usable only when its RSVP belongs to that
event and its current same-channel contact matches the normalized destination.
Missing, mismatched, dangling, or cross-event links are conflicts. Unlinked
history may be attached to a safely resolved or newly created RSVP.

Treat `RSVP.guestName` as the event name authority. Host-supplied names apply
to new event RSVPs and never update `User.name`.

Serialize invitation preparation with a PostgreSQL transaction advisory lock
keyed by event and normalized contact. All invitation entry points share the
lock. Resolve current state, compare reviewed name and disposition, and prepare
records inside the transaction. Send email or SMS after the transaction ends.

## Consequences

Concurrent reviewed-new requests cannot create duplicate invitation RSVPs;
the later request must review the changed state. Historical delivery records
cannot grant an old contact access to a current RSVP. Delivery failures can
leave prepared invitation records, so retries resolve and review current state
before sending again. External delivery does not hold database locks.

Every host entry point sends a reviewed expectation. The invitation composer
and the guest-list Resend both preview first and send the reviewed disposition
and name. The unreviewed host `inviteGuest` action was retired in `8be23944`.
Guest-to-guest invitations are not reviewed, but they share the same lock.
