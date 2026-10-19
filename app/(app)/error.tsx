"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Ui.Errors.Common");
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "40px 32px",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
        <h2
          style={{
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: 800,
            margin: "0 0 8px",
          }}
        >
          {t("title")}
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
            lineHeight: 1.6,
            marginBottom: "24px",
          }}
        >
          {t("description")}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              background: "#a855f7",
              color: "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "11px 22px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("retry")}
          </button>
          <Link
            href="/dashboard"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
              padding: "11px 22px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            {t("dashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
