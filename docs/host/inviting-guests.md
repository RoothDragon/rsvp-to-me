---
title: Inviting Guests
description: Share a link or send email and text invitations.
category: Guests & RSVPs
audience: host
order: 50
---

# Inviting Guests

There are two ways to get guests to your event: share the link, or send invitations from the guest management area.

---

## Share the Link

Every event has its own web address. Copy it and share it however you like — group chat, social media, email signature. Anyone who can [see the event](visibility-and-privacy.md) can RSVP from the link.

---

## Send Invitations

From the guest management area you can send invitations directly:

- **Email invites** — enter guest email addresses to send invitation links (available when email is enabled on your site).
- **SMS invites** — enter guest phone numbers to send text invitations (available when texting is enabled).

Invited guests appear on your guest list with an **Invited** status until they respond.

Paste recipients separated by commas or newlines. Each recipient can be a bare email address
or phone number, or a name followed by the contact in angle brackets:

```text
Alex Rivera <alex@example.com>
"Rivera, Alex" <alex.work@example.com>, +15551234567
```

Quote names that contain commas. Names are optional: a new recipient without a name receives
a generic guest label. An existing event guest keeps their current RSVP name, even if the
pasted name differs. Invitation names belong to this event and do not change account profiles.

Review the parsed recipients before sending. Use a recipient's source link to find its original
text, edit its name or contact, and undo draft changes. Invalid entries stay visible so you can
fix them; suggested repairs are applied only when you choose them.

For spreadsheet data, paste tab-separated cells into the invitation editor or open its spreadsheet
import. Explicitly choose the contact column, optional name column, and whether the first row is
a header, then review the mapped rows before importing them. Columns are not silently guessed.

If a contact appears more than once, choose one entry before sending. Each contact identifies
one primary RSVP; use [plus-ones](managing-rsvps.md#plus-ones) for a family or party sharing a
contact rather than creating separate invitations with the same address or number.

The review distinguishes new recipients, guests already invited, and guests who have responded
to this event. Previously invited or responded guests require an explicit resend choice.
Resolve any contact conflict before sending. You can also preview an individual recipient's
invitation email with the name that will be used.

Delivery results are shown for each recipient. Successfully sent recipients are removed from
the draft; failed recipients remain available to correct, review again, and retry. Retrying does
not automatically resend invitations to the successful recipients.

> **Anti-abuse:** You can invite up to **200 recipients per request** (paste more than that and it'll ask you to split into batches), and there's an hourly cap on how many invite batches you can send per event. When your administrator enables bot protection, each host, co-host, or guest invitation submission also receives an interaction-only security check. These controls prevent spam and runaway texting costs if an account is misused.

### Invitation History

The invitations table tracks when each invite was sent and whether the guest has responded yet, so you can follow up with anyone who hasn't.

Each batch of invites you send also shows up in the event's **activity feed**, attributed to whoever sent it. On a shared event this gives you and your co-hosts a clear record of who invited how many people and when.

---

## Let Guests Invite Friends

On a **Private** event, you can turn on an option that lets your invited guests send their own invitations — handy for word-of-mouth gatherings. See [Visibility & Privacy](visibility-and-privacy.md). This option is only available on private events.

Guests can optionally provide a friend's name with the invitation. The name is saved for this
event only; if the contact already has an RSVP here, its established name is retained.

---

## Reminders for Non-Responders

You don't have to chase people manually — RSVP to Me can automatically nudge guests who haven't responded. See [Messaging Guests & Reminders](messaging-and-reminders.md).
