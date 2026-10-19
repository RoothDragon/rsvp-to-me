import { requireEmailI18n } from "../i18n";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import type { ApprovalEmailProps } from "../types";

export function ApprovalEmail({
  i18n,
  theme,
  toggles,
  eventTitle,
  approved,
  hostMessage,
  eventUrl,
}: ApprovalEmailProps) {
  const { t } = requireEmailI18n(i18n);
  return (
    <EmailLayout
      i18n={i18n}
      theme={theme}
      preview={t(approved ? "Email.approval.previewApproved" : "Email.approval.previewDeclined", {
        eventTitle,
      })}
    >
      <Hero
        theme={theme}
        kicker={t(approved ? "Email.approval.kickerApproved" : "Email.approval.kickerDeclined")}
        title={eventTitle}
        showCoverImage={toggles.showCoverImage}
      />
      <table
        align="center"
        width="100%"
        border={0}
        cellPadding="0"
        cellSpacing="0"
        role="presentation"
        className="email-content"
        style={{ padding: "24px 32px 30px" }}
      >
        <tbody>
          <tr>
            <td>
              <h2
                className="dm-text-primary"
                style={{
                  margin: 0,
                  fontFamily: theme.headingFont,
                  fontWeight: theme.headingWeight,
                  textTransform: theme.headingTransform as "uppercase" | "none",
                  fontSize: "20px",
                  color: theme.textPrimary,
                }}
              >
                {t(approved ? "Email.approval.headingApproved" : "Email.approval.headingDeclined")}
              </h2>
              <p
                className="dm-text-secondary"
                style={{
                  margin: "10px 0 0",
                  fontSize: "15px",
                  lineHeight: "24px",
                  color: theme.textSecondary,
                }}
              >
                {t(approved ? "Email.approval.bodyApproved" : "Email.approval.bodyDeclined", {
                  eventTitle,
                })}
              </p>

              {hostMessage ? (
                <table
                  align="center"
                  width="100%"
                  border={0}
                  cellPadding="0"
                  cellSpacing="0"
                  role="presentation"
                  className="dm-block"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderLeft: `3px solid ${theme.accent}`,
                    borderRadius: "6px",
                    padding: "12px 16px",
                    margin: "18px 0 0",
                  }}
                >
                  <tbody>
                    <tr>
                      <td>
                        <p
                          className="dm-text-secondary"
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            lineHeight: "22px",
                            fontStyle: "italic",
                            color: theme.textSecondary,
                          }}
                        >
                          {t("Email.approval.hostMessage", { message: hostMessage })}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : null}

              {approved ? (
                <table
                  align="center"
                  width="100%"
                  border={0}
                  cellPadding="0"
                  cellSpacing="0"
                  role="presentation"
                  style={{ margin: "26px 0 0", textAlign: "center" as const }}
                >
                  <tbody>
                    <tr>
                      <td>
                        <EmailButton theme={theme} href={eventUrl} variant="primary">
                          {t("Email.viewEvent")}
                        </EmailButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
