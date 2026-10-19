"use client";

import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import {
  GUEST_RSVP_GROUPS,
  resolveGuestRsvpDisplay,
  type GuestCountDisplay,
  type GuestListDisplay,
  type GuestRsvpDisplayFields,
} from "@/lib/guestRsvpDisplay";
import { GuestRsvpGroup } from "../GuestRsvpGroup";
import type { SettingsPageStyles } from "./styles";

export function GuestRsvpDisplaySettings({
  value,
  onChange,
  guestListVis,
  t,
  S,
}: {
  value: GuestRsvpDisplayFields;
  onChange: (update: Partial<GuestRsvpDisplayFields>) => void;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  const shared = useTranslations("Ui.Event.shared");
  const translate = useTranslations("Ui.Event.GuestRsvpDisplaySettings");

  const display = resolveGuestRsvpDisplay(value);
  const hostOnly = guestListVis === "HOST_ONLY";

  return (
    <section aria-labelledby="guest-rsvp-display-heading" style={{ margin: "20px 0 24px" }}>
      <h3 id="guest-rsvp-display-heading" style={{ fontSize: "14px", fontWeight: 700 }}>
        {translate("guestFacingRsvpDisplay")}
      </h3>
      <p style={{ color: t.textSecondary, fontSize: "13px", lineHeight: 1.6 }}>
        {translate("chooseHowGuestsSeeResponseLists")} <strong>{translate("hostDetails")}</strong>
      </p>
      <p style={{ color: t.textMuted, fontSize: "12px", lineHeight: 1.6 }}>
        {translate("showImmediatelyDisplaysNamesWhenPage")}
      </p>
      {hostOnly && (
        <p style={{ color: t.textSecondary, fontSize: "13px" }}>
          {translate("guestListCurrentlyHostOnlyThese")}
        </p>
      )}
      {GUEST_RSVP_GROUPS.map(({ status, listField, countField }) => {
        const label = shared("guestStatuses." + status);
        return (
          <fieldset
            key={status}
            disabled={hostOnly}
            style={{
              border: `1px solid ${t.cardBorder}`,
              borderRadius: "12px",
              padding: "12px",
              margin: "14px 0",
              minWidth: 0,
              opacity: hostOnly ? 0.6 : 1,
            }}
          >
            <legend
              style={{ color: t.textPrimary, fontSize: "14px", fontWeight: 700, padding: "0 6px" }}
            >
              {label}
            </legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <label style={{ color: t.textSecondary, fontSize: "12px" }}>
                {translate("guestNames")}{" "}
                <select
                  aria-label={translate("namesLabel", { label })}
                  value={value[listField]}
                  onChange={(event) =>
                    onChange({ [listField]: event.target.value as GuestListDisplay })
                  }
                  style={{ ...S.inp, marginTop: "6px" }}
                >
                  <option value="EXPANDED">{translate("showImmediately")}</option>
                  <option value="COLLAPSED">{translate("showAfterClick")}</option>
                  <option value="HIDDEN">{translate("doNotDisplay")}</option>
                </select>
              </label>
              {value[listField] !== "HIDDEN" && (
                <label style={{ color: t.textSecondary, fontSize: "12px" }}>
                  {translate("countShownGuests")}{" "}
                  <select
                    aria-label={translate("countsLabel", { label })}
                    value={value[countField]}
                    onChange={(event) =>
                      onChange({ [countField]: event.target.value as GuestCountDisplay })
                    }
                    style={{ ...S.inp, marginTop: "6px" }}
                  >
                    <option value="EXACT">{translate("exactCount")}</option>
                    <option value="HIDDEN">{translate("noCount")}</option>
                    {status === "NO" && <option value="CAPPED">{translate("limit3")}</option>}
                  </select>
                </label>
              )}
            </div>
            {value[listField] !== "HIDDEN" && value[countField] === "CAPPED" && (
              <p style={{ color: t.textMuted, fontSize: "12px" }}>
                {translate("guestsSee1Or2Smaller")}
              </p>
            )}
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                borderRadius: "8px",
                background: t.inputBg,
              }}
            >
              <p style={{ color: t.textMuted, fontSize: "11px", margin: "0 0 8px" }}>
                {translate("guestPreviewExampleResponses")}
              </p>
              {value[listField] === "HIDDEN" ? (
                <span style={{ color: t.textMuted, fontSize: "12px" }}>
                  {translate("responseTypeNotDisplayedGuests")}
                </span>
              ) : (
                <GuestRsvpGroup
                  key={value[listField]}
                  label={label}
                  count={status === "NO" ? 13 : status === "GOING" ? 5 : 2}
                  display={display[status]}
                  t={t}
                >
                  <span style={{ color: t.textSecondary, fontSize: "12px" }}>
                    {translate("guestNamesAppearHere")}
                  </span>
                </GuestRsvpGroup>
              )}
            </div>
          </fieldset>
        );
      })}
      <p style={{ color: t.textMuted, fontSize: "12px", lineHeight: 1.6 }}>
        {translate("theseDisplayPreferencesGuestListVisibility")}
      </p>
    </section>
  );
}
