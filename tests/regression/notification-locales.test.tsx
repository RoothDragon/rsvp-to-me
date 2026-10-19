// Root cause: built-in notification copy was fixed English and locale was lost
// when recipient batches were reduced to destinations. Keep domain/protocol IDs
// stable, apply recipient locale before rendering defaults, preserve authored text.
import { describe, it, expect, vi } from "vitest";
import { buildSampleEmail, getEmailTemplateMeta } from "@/emails/registry";
import { renderEmail } from "@/emails/render";
import { RsvpConfirmationEmail } from "@/emails/templates/RsvpConfirmationEmail";
import { sampleEventDetails } from "@/emails/registry";
import { DEFAULT_TOGGLES } from "@/emails/types";
import { appShellEmailTheme } from "@/lib/email-theme";
import { getTranslator } from "@/i18n/server";
import { mergeWithDefaults } from "@/lib/email-settings";
import { groupRecipientsByLocale, resolveRecipientGroups } from "@/emails/recipients";
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findMany } } }));
const theme = appShellEmailTheme();
describe("notification locales", () => {
  it("renders English and Dutch defaults including subject status/decision, HTML lang, dates and protocol links", async () => {
    for (const locale of ["en-US", "nl-NL"] as const) {
      const approval = await buildSampleEmail("approval", theme, undefined, locale);
      expect(approval.subject).toContain(locale === "nl-NL" ? "Goedgekeurd" : "Approved");
      const alert = await buildSampleEmail("hostRsvpAlert", theme, undefined, locale);
      expect(alert.subject).toContain(locale === "nl-NL" ? "Aanwezig" : "Going");
      const invite = await buildSampleEmail("invite", theme, undefined, locale);
      const rendered = await renderEmail(invite.element);
      expect(rendered.html).toContain(`lang="${locale}"`);
      expect(rendered.text.toLowerCase()).toContain(locale === "nl-NL" ? "vrijdag" : "friday");
      for (const status of ["GOING", "MAYBE", "NO"])
        expect(rendered.html).toContain(`status=${status}`);
    }
  });
  it("localizes every canonical RSVP status without translating enum values", async () => {
    for (const [status, label] of [
      ["GOING", "Aanwezig"],
      ["MAYBE", "Misschien"],
      ["NO", "Afwezig"],
    ] as const) {
      const rendered = await renderEmail(
        <RsvpConfirmationEmail
          theme={theme}
          body="Eigen tekst"
          toggles={DEFAULT_TOGGLES}
          event={sampleEventDetails()}
          status={status}
          eventUrl="https://example.com/event"
          editUrl="https://example.com/edit"
        />,
        "nl-NL"
      );
      expect(rendered.text.toLowerCase()).toContain(label.toLowerCase());
      expect(rendered.text).toContain("Eigen tekst");
    }
  });
  it("preserves legacy admin overrides and user braces without parsing them as ICU", async () => {
    const sample = await buildSampleEmail(
      "invite",
      theme,
      {
        subject: "Don't change {eventTitle}: {unknown}",
        body: "Host's {guestName}: {unknown} <script>",
      },
      "nl-NL"
    );
    expect(sample.subject).toBe("Don't change Backyard Wine Night: {unknown}");
    const rendered = await renderEmail(sample.element);
    expect(rendered.html).toContain("{unknown} &lt;script&gt;");
    const t = await getTranslator("nl-NL");
    const defaults = mergeWithDefaults("invite", {}, t, {
      eventTitle: "{guestName}",
      hostName: "O'Brien",
      guestName: "Alex",
    });
    expect(defaults.subject).toBe("Je bent uitgenodigd: {guestName}");
    expect(defaults.body).toContain("O'Brien");
    expect(getEmailTemplateMeta(t).invite.defaultSubject).toBe("Je bent uitgenodigd: {eventTitle}");
  });
  it("groups persisted preferences, unknown locales and destinations in one batch lookup", async () => {
    findMany.mockResolvedValue([
      { email: "nl@example.com", phone: null, preferredLocale: "nl-NL" },
      { email: "bad@example.com", phone: null, preferredLocale: "retired" },
    ]);
    const groups = await resolveRecipientGroups(
      ["nl@example.com", "unknown@example.com", "bad@example.com"],
      "email"
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(groups.get("nl-NL")).toEqual(["nl@example.com"]);
    expect(groups.get("en-US")).toEqual(["unknown@example.com", "bad@example.com"]);
    expect(
      groupRecipientsByLocale([
        { address: "a", preferredLocale: "nl-NL" },
        { address: "a", preferredLocale: "nl-NL" },
      ]).get("nl-NL")
    ).toEqual(["a", "a"]);
  });
});
