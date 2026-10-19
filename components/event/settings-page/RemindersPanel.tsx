"use client";

import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import type { ReminderOverrides } from "./types";
import { Label, Section, Toggle } from "./ui";

export function RemindersPanel({
  channelConfig,
  nudgeUnresponded,
  setNudgeUnresponded,
  emailWeekBefore,
  setEmailWeekBefore,
  emailDayBefore,
  setEmailDayBefore,
  emailHoursBefore,
  setEmailHoursBefore,
  smsWeekBefore,
  setSmsWeekBefore,
  smsDayBefore,
  setSmsDayBefore,
  smsHoursBefore,
  setSmsHoursBefore,
  triggerSaveReminders,
  t,
}: {
  channelConfig: { email: boolean; sms: boolean };
  nudgeUnresponded: boolean;
  setNudgeUnresponded: React.Dispatch<React.SetStateAction<boolean>>;
  emailWeekBefore: boolean;
  setEmailWeekBefore: React.Dispatch<React.SetStateAction<boolean>>;
  emailDayBefore: boolean;
  setEmailDayBefore: React.Dispatch<React.SetStateAction<boolean>>;
  emailHoursBefore: number;
  setEmailHoursBefore: React.Dispatch<React.SetStateAction<number>>;
  smsWeekBefore: boolean;
  setSmsWeekBefore: React.Dispatch<React.SetStateAction<boolean>>;
  smsDayBefore: boolean;
  setSmsDayBefore: React.Dispatch<React.SetStateAction<boolean>>;
  smsHoursBefore: number;
  setSmsHoursBefore: React.Dispatch<React.SetStateAction<number>>;
  triggerSaveReminders: (overrides: ReminderOverrides) => void;
  t: ResolvedTheme;
}) {
  const translate = useTranslations("Ui.Event.RemindersPanel");

  return (
    <Section title={translate("autoReminders")} t={t}>
      {!channelConfig.email && !channelConfig.sms ? (
        <div style={{ fontSize: "13px", color: t.textMuted }}>
          {translate("remindersRequireAtLeastOneMessaging")}
        </div>
      ) : (
        <>
          <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "16px" }}>
            {channelConfig.email && channelConfig.sms
              ? translate("remindersSentGuestsWhoProvidedTheir")
              : channelConfig.email
                ? translate("remindersSentGuestsWhoProvidedTheir2")
                : translate("remindersSentGuestsWhoProvidedTheir3")}
          </div>
          <Toggle
            label={translate("nudgeGuestsWhoHavenTRsvp")}
            value={nudgeUnresponded}
            onChange={(val) => {
              setNudgeUnresponded(val);
              triggerSaveReminders({ nudgeUnresponded: val });
            }}
            t={t}
          />
          {channelConfig.email && (
            <div style={{ marginBottom: "20px" }}>
              <Label t={t}>{translate("emailReminders")}</Label>
              <Toggle
                label={translate("1WeekBefore")}
                value={emailWeekBefore}
                onChange={(val) => {
                  setEmailWeekBefore(val);
                  triggerSaveReminders({ emailWeekBefore: val });
                }}
                t={t}
              />
              <Toggle
                label={translate("1DayBefore")}
                value={emailDayBefore}
                onChange={(val) => {
                  setEmailDayBefore(val);
                  triggerSaveReminders({ emailDayBefore: val });
                }}
                t={t}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>
                  {translate("hoursBefore")}
                </span>
                <select
                  value={emailHoursBefore}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEmailHoursBefore(val);
                    triggerSaveReminders({ emailHoursBefore: val });
                  }}
                  style={{
                    padding: "6px 10px",
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: "8px",
                    color: t.textPrimary,
                    fontFamily: "inherit",
                    colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
                    cursor: "pointer",
                  }}
                >
                  <option value={0}>{translate("off")}</option>
                  <option value={1}>{translate("1Hour")}</option>
                  <option value={2}>{translate("2Hours")}</option>
                  <option value={4}>{translate("4Hours")}</option>
                </select>
              </div>
            </div>
          )}
          {channelConfig.sms && (
            <div style={{ marginBottom: "20px" }}>
              <Label t={t}>{translate("smsReminders")}</Label>
              <Toggle
                label={translate("1WeekBefore")}
                value={smsWeekBefore}
                onChange={(val) => {
                  setSmsWeekBefore(val);
                  triggerSaveReminders({ smsWeekBefore: val });
                }}
                t={t}
              />
              <Toggle
                label={translate("1DayBefore")}
                value={smsDayBefore}
                onChange={(val) => {
                  setSmsDayBefore(val);
                  triggerSaveReminders({ smsDayBefore: val });
                }}
                t={t}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>
                  {translate("hoursBefore")}
                </span>
                <select
                  value={smsHoursBefore}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSmsHoursBefore(val);
                    triggerSaveReminders({ smsHoursBefore: val });
                  }}
                  style={{
                    padding: "6px 10px",
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: "8px",
                    color: t.textPrimary,
                    fontFamily: "inherit",
                    colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
                    cursor: "pointer",
                  }}
                >
                  <option value={0}>{translate("off")}</option>
                  <option value={1}>{translate("1Hour")}</option>
                  <option value={2}>{translate("2Hours")}</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
