import { requireEmailI18n, type EmailI18nProps } from "../i18n";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { EmailButton } from "../components/EmailButton";
import { DetailsCard } from "../components/DetailsCard";
import { formatEventDateTime } from "@/lib/calendar";
import type { EventEmailDetails } from "../components/DetailsCard";
import type { EmailTheme } from "@/lib/email-theme";

interface CoHostInviteEmailProps extends EmailI18nProps {
  theme: EmailTheme;
  event: EventEmailDetails;
  hostName: string;
  inviteUrl: string;
}

export function CoHostInviteEmail({
  i18n,
  theme,
  event,
  hostName,
  inviteUrl,
}: CoHostInviteEmailProps) {
  const { t, locale } = requireEmailI18n(i18n);
  const { date } = formatEventDateTime(event.startAt, event.endAt, event.timezone, locale);
  const subtitle = event.locationName ? `${date} · ${event.locationName}` : date;
  return (
    <EmailLayout
      i18n={i18n}
      theme={theme}
      preview={t("Email.cohost.preview", { hostName, eventTitle: event.title })}
    >
      <Hero
        theme={theme}
        kicker={t("Email.cohost.kicker")}
        title={event.title}
        subtitle={subtitle}
        showCoverImage={false}
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
              <p
                className="dm-text-primary"
                style={{
                  margin: "0",
                  fontSize: "15px",
                  lineHeight: "24px",
                  color: theme.textPrimary,
                }}
              >
                {t("Email.cohost.body", { hostName, eventTitle: event.title })}
              </p>

              <DetailsCard
                i18n={i18n}
                theme={theme}
                event={event}
                showMapLink={true}
                showCalendarLinks={false}
              />

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
                      <EmailButton theme={theme} href={inviteUrl} variant="primary">
                        {t("Email.cohost.button")}
                      </EmailButton>
                    </td>
                  </tr>
                </tbody>
              </table>

              <p
                className="dm-text-muted"
                style={{
                  margin: "24px 0 0",
                  fontSize: "12px",
                  color: theme.textMuted,
                  textAlign: "center" as const,
                }}
              >
                {t("Email.cohost.ignore")}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
