"use client";
import { useTranslations } from "next-intl";

import { Eye, EyeOff } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";

export function SmsTab({
  config,
  handleToggleSmsEnabled,
  handleSaveSmsConfig,
  twilioAccountSid,
  setTwilioAccountSid,
  showTwilioToken,
  setShowTwilioToken,
  twilioAuthToken,
  setTwilioAuthToken,
  twilioPhoneNumber,
  setTwilioPhoneNumber,
  smsTestTo,
  setSmsTestTo,
  isPending,
  isTestingSms,
  handleTestSmsConfig,
}: {
  config: Record<string, string>;
  handleToggleSmsEnabled: () => void;
  handleSaveSmsConfig: (e: React.FormEvent) => void;
  twilioAccountSid: string;
  setTwilioAccountSid: React.Dispatch<React.SetStateAction<string>>;
  showTwilioToken: boolean;
  setShowTwilioToken: React.Dispatch<React.SetStateAction<boolean>>;
  twilioAuthToken: string;
  setTwilioAuthToken: React.Dispatch<React.SetStateAction<string>>;
  twilioPhoneNumber: string;
  setTwilioPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  smsTestTo: string;
  setSmsTestTo: React.Dispatch<React.SetStateAction<string>>;
  isPending: boolean;
  isTestingSms: boolean;
  handleTestSmsConfig: () => Promise<void>;
}) {
  const tr = useTranslations("Ui.Admin");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Guest SMS Channel Toggle */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: APP_SHELL.textPrimary }}>
              {tr("smsNotifications")}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: APP_SHELL.textSecondary,
                marginTop: "4px",
                maxWidth: "420px",
              }}
            >
              {tr("whenOnGuestsReceiveSmsConfirmationsBlastsRemindersAnd")}
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleSmsEnabled}
            style={{
              width: "50px",
              height: "26px",
              borderRadius: "13px",
              border: "none",
              backgroundColor:
                config.sms_enabled === "true" ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
              cursor: "pointer",
              position: "relative",
              transition: "background-color 0.2s",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                position: "absolute",
                top: "3px",
                left: config.sms_enabled === "true" ? "27px" : "3px",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: APP_SHELL.textPrimary,
              margin: 0,
            }}
          >
            {tr("smsConfigurationTwilio")}
          </h3>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            {tr("configureYourTwilioAccountToEnableSmsBlastsRsvp")}
          </p>
        </div>

        <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

        <form
          onSubmit={handleSaveSmsConfig}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: APP_SHELL.textSecondary,
                marginBottom: "6px",
              }}
            >
              {tr("twilioAccountSidTwilioAccountSid")}
            </label>
            <input
              type="text"
              placeholder={tr("eGAcxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")}
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: APP_SHELL.inputBg,
                border: `1px solid ${APP_SHELL.inputBorder}`,
                borderRadius: APP_SHELL.inputRadius,
                padding: "10px 14px",
                color: APP_SHELL.textPrimary,
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: APP_SHELL.textSecondary,
                marginBottom: "6px",
              }}
            >
              {tr("twilioAuthTokenTwilioAuthToken")}
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type={showTwilioToken ? "text" : "password"}
                  placeholder={tr("twilioAuthenticationToken")}
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "10px 40px 10px 14px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowTwilioToken(!showTwilioToken)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: APP_SHELL.textSecondary,
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={showTwilioToken ? tr("hideToken") : tr("showToken")}
                >
                  {showTwilioToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: APP_SHELL.textSecondary,
                marginBottom: "6px",
              }}
            >
              {tr("twilioPhoneNumberTwilioPhoneNumber")}
            </label>
            <input
              type="text"
              placeholder={tr("eG1234567890")}
              value={twilioPhoneNumber}
              onChange={(e) => setTwilioPhoneNumber(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: APP_SHELL.inputBg,
                border: `1px solid ${APP_SHELL.inputBorder}`,
                borderRadius: APP_SHELL.inputRadius,
                padding: "10px 14px",
                color: APP_SHELL.textPrimary,
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            style={{
              height: "1px",
              backgroundColor: APP_SHELL.navBorder,
              margin: "10px 0",
            }}
          />

          {/* SMS Testing Panel */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "rgba(255,255,255,0.02)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: APP_SHELL.textPrimary,
                margin: "0 0 6px 0",
              }}
            >
              {tr("testSmsConfiguration")}
            </h4>
            <p
              style={{
                fontSize: "11px",
                color: APP_SHELL.textSecondary,
                margin: "0 0 12px 0",
                lineHeight: "1.4",
              }}
            >
              {tr("verifyYourTwilioConnectionBySendingATestSms")}
            </p>

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: APP_SHELL.textSecondary,
                    marginBottom: "4px",
                  }}
                >
                  {tr("testRecipientPhoneNumber")}
                </label>
                <input
                  type="text"
                  placeholder={tr("eG15550199")}
                  value={smsTestTo}
                  onChange={(e) => setSmsTestTo(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "8px 12px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "12px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="button"
                disabled={isPending || isTestingSms}
                onClick={handleTestSmsConfig}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  color: APP_SHELL.textPrimary,
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isPending || isTestingSms ? "not-allowed" : "pointer",
                  opacity: isPending || isTestingSms ? 0.6 : 1,
                  whiteSpace: "nowrap",
                  height: "33px",
                }}
              >
                {isTestingSms ? tr("sending") : tr("testConnection")}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "10px",
            }}
          >
            <button
              type="submit"
              disabled={isPending || isTestingSms}
              style={{
                backgroundColor: APP_SHELL.accent,
                border: "none",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isPending || isTestingSms ? "not-allowed" : "pointer",
                opacity: isPending || isTestingSms ? 0.6 : 1,
              }}
            >
              {tr("saveSettings")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
