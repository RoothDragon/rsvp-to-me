import { requireEmailI18n } from "../i18n";
import { EmailLayout } from "../components/EmailLayout";
import { Hero } from "../components/Hero";
import { splitParagraphs } from "../render";
import type { TestEmailProps } from "../types";

export function TestEmail({ i18n, theme, body }: TestEmailProps) {
  const { t } = requireEmailI18n(i18n);
  return (
    <EmailLayout i18n={i18n} theme={theme} preview={t("Email.test.preview")}>
      <Hero
        theme={theme}
        kicker="RSVP to Me"
        title={t("Email.test.title")}
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
              {splitParagraphs(body).map((paragraph, i) => (
                <p
                  key={i}
                  className="dm-text-secondary"
                  style={{
                    margin: i === 0 ? "0" : "12px 0 0",
                    fontSize: "15px",
                    lineHeight: "24px",
                    color: theme.textSecondary,
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
