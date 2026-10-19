"use client";
import { useLocale, useTranslations } from "next-intl";

import { APP_SHELL } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import type { BackupFile } from "./types";

export function BackupsTab({
  handleSaveBackupConfig,
  backupSchedule,
  setBackupSchedule,
  backupKeepCount,
  setBackupKeepCount,
  lastBackupTime,
  isSavingBackupConfig,
  handleCreateBackup,
  isBackupRunning,
  backups,
  handleDeleteBackup,
}: {
  handleSaveBackupConfig: (e: React.FormEvent) => Promise<void>;
  backupSchedule: string;
  setBackupSchedule: React.Dispatch<React.SetStateAction<string>>;
  backupKeepCount: number;
  setBackupKeepCount: React.Dispatch<React.SetStateAction<number>>;
  lastBackupTime: string;
  isSavingBackupConfig: boolean;
  handleCreateBackup: () => Promise<void>;
  isBackupRunning: boolean;
  backups: BackupFile[];
  handleDeleteBackup: (filename: string) => Promise<void>;
}) {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();
  const BACKUP_PRESETS = [
    { label: tr("backupPreset0"), value: "disabled" },
    { label: tr("backupPreset1"), value: "0 * * * *" },
    { label: tr("backupPreset2"), value: "0 */6 * * *" },
    { label: tr("backupPreset3"), value: "0 0 * * *" },
    { label: tr("backupPreset4"), value: "0 0 */3 * *" },
    { label: tr("backupPreset5"), value: "0 0 * * 0" },
    { label: tr("backupPreset6"), value: "custom" },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Section 1: Backup settings */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
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
            {tr("backupConfiguration")}
          </h3>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            {tr("configureScheduledDatabaseBackupsBackupsAreStoredInThe")}
          </p>
        </div>

        <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

        <form
          onSubmit={handleSaveBackupConfig}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: APP_SHELL.textSecondary,
                }}
              >
                {tr("backupSchedule")}
              </label>
              {(() => {
                const isCustom = !BACKUP_PRESETS.some(
                  (p) => p.value !== "custom" && p.value === backupSchedule
                );
                return (
                  <>
                    <select
                      value={isCustom ? "custom" : backupSchedule}
                      onChange={(e) => {
                        if (e.target.value !== "custom") setBackupSchedule(e.target.value);
                      }}
                      style={{
                        backgroundColor: APP_SHELL.inputBg,
                        border: `1px solid ${APP_SHELL.inputBorder}`,
                        borderRadius: "10px",
                        padding: "10px 14px",
                        fontSize: "14px",
                        color: APP_SHELL.textPrimary,
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      {BACKUP_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {isCustom && (
                      <input
                        type="text"
                        value={backupSchedule}
                        onChange={(e) => setBackupSchedule(e.target.value)}
                        placeholder={tr("eG00OrDisabled")}
                        required
                        style={{
                          backgroundColor: APP_SHELL.inputBg,
                          border: `1px solid ${APP_SHELL.inputBorder}`,
                          borderRadius: "10px",
                          padding: "10px 14px",
                          fontSize: "14px",
                          color: APP_SHELL.textPrimary,
                          outline: "none",
                        }}
                      />
                    )}
                    <span style={{ fontSize: "11px", color: APP_SHELL.textMuted }}>
                      {isCustom
                        ? tr("standard5FieldCronSyntaxMinuteHourDayOf")
                        : backupSchedule === "disabled"
                          ? tr("automatedBackupsOff")
                          : tr("cronSchedule", { schedule: backupSchedule })}
                    </span>
                  </>
                );
              })()}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: APP_SHELL.textSecondary,
                }}
              >
                {tr("backupsToRetainRotationLimit")}
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={backupKeepCount}
                onChange={(e) => setBackupKeepCount(parseInt(e.target.value, 10) || 7)}
                required
                style={{
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  color: APP_SHELL.textPrimary,
                  outline: "none",
                }}
              />
              <span style={{ fontSize: "11px", color: APP_SHELL.textMuted }}>
                {tr("maximumNumberOfBackupFilesToKeepOlderBackups")}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>
              <strong>{tr("lastBackupCompleted")}</strong>{" "}
              {lastBackupTime ? new Date(lastBackupTime).toLocaleString(locale) : tr("never")}
            </div>

            <button
              type="submit"
              disabled={isSavingBackupConfig}
              style={{
                backgroundColor: APP_SHELL.accent,
                border: "none",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isSavingBackupConfig ? "not-allowed" : "pointer",
                opacity: isSavingBackupConfig ? 0.6 : 1,
              }}
            >
              {isSavingBackupConfig ? tr("saving2") : tr("saveBackupSettings")}
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Manual Trigger */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ maxWidth: "70%" }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: APP_SHELL.textPrimary,
              margin: 0,
            }}
          >
            {tr("manualDatabaseBackup")}
          </h3>
          <p
            style={{
              color: APP_SHELL.textSecondary,
              fontSize: "13px",
              marginTop: "4px",
              margin: 0,
            }}
          >
            {tr.rich("instantlyTriggerADatabaseSnapshotUsingPgDumpMessage", {
              part0: (chunks) => <code>{chunks}</code>,
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateBackup}
          disabled={isBackupRunning}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            border: `1px solid ${APP_SHELL.inputBorder}`,
            color: APP_SHELL.textPrimary,
            borderRadius: "10px",
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: isBackupRunning ? "not-allowed" : "pointer",
            opacity: isBackupRunning ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isBackupRunning ? tr("backingUp") : tr("createBackupNow")}
        </button>
      </div>

      {/* Section 3: Backup List */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
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
            {tr("backupArchives")}
          </h3>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            {tr("listOfStoredBackupsOnThisServer")}
          </p>
        </div>

        <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                  color: APP_SHELL.textSecondary,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                <th style={{ padding: "12px" }}>{tr("filename")}</th>
                <th style={{ padding: "12px" }}>{tr("createdAt")}</th>
                <th style={{ padding: "12px" }}>{tr("fileSize")}</th>
                <th style={{ padding: "12px", textAlign: "right" }}>{tr("actions2")}</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: APP_SHELL.textMuted,
                    }}
                  >
                    {tr("noBackupArchivesFoundCreateOneManuallyOrConfigure")}
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr
                    key={b.filename}
                    style={{
                      borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                      fontSize: "14px",
                    }}
                  >
                    <td
                      style={{
                        padding: "14px 12px",
                        fontFamily: "monospace",
                        color: APP_SHELL.textPrimary,
                      }}
                    >
                      {b.filename}
                    </td>
                    <td style={{ padding: "14px 12px", color: APP_SHELL.textSecondary }}>
                      {new Date(b.createdAt).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: "14px 12px", color: APP_SHELL.textSecondary }}>
                      {b.sizeBytes >= 1024 * 1024
                        ? `${(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                        : `${(b.sizeBytes / 1024).toFixed(2)} KB`}
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "16px" }}>
                        <a
                          href={`/api/admin/backups/${b.filename}`}
                          download
                          style={{
                            color: APP_SHELL.accent,
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "13px",
                          }}
                        >
                          {tr("download")}
                        </a>
                        <button
                          onClick={() => handleDeleteBackup(b.filename)}
                          style={{
                            backgroundColor: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "13px",
                            padding: 0,
                          }}
                        >
                          {tr("delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
