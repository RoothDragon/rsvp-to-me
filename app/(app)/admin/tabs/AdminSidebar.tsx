"use client";
import { useTranslations } from "next-intl";

import { APP_SHELL } from "@/lib/theme";
import type { AdminFeedback, TabId } from "./types";

export function AdminSidebar({
  activeTab,
  handleTabChange,
  setFeedback,
}: {
  activeTab: TabId;
  handleTabChange: (id: TabId) => void;
  setFeedback: React.Dispatch<React.SetStateAction<AdminFeedback | null>>;
}) {
  const tr = useTranslations("Ui.Admin");

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-[240px] shrink-0 lg:border-b-0 mb-4 lg:mb-0">
      {(
        [
          { id: "overview", label: tr("overview2") },
          { id: "users", label: tr("userManagement") },
          { id: "events", label: tr("eventModeration") },
          { id: "invites", label: tr("hostSettings") },
          { id: "email", label: tr("emailSettings") },
          { id: "sms", label: tr("smsSettings") },
          { id: "themes", label: tr("themePresets2") },
          { id: "backups", label: tr("databaseBackups") },
          { id: "docs", label: tr("documentation") },
        ] as const
      ).map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            handleTabChange(tab.id);
            setFeedback(null);
          }}
          style={{
            textAlign: "left",
            padding: "10px 14px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: activeTab === tab.id ? APP_SHELL.accent : "transparent",
            color: activeTab === tab.id ? "#fff" : APP_SHELL.textSecondary,
            fontSize: "14px",
            fontWeight: activeTab === tab.id ? 700 : 600,
            cursor: "pointer",
            transition: "background 0.2s, color 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id)
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
