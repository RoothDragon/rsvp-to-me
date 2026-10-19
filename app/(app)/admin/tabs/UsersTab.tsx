"use client";
import { useLocale, useTranslations } from "next-intl";

import { APP_SHELL } from "@/lib/theme";
import { AppInput, appCardStyle, appInputStyle } from "@/components/ui/AppPrimitives";
import type { AdminUser } from "./types";

export function UsersTab({
  userSearch,
  handleUserSearch,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  setCreateUserOpen,
  filteredUsers,
  handleRoleChange,
  handleCancelDeletion,
  handleUserDeleteImmediately,
  handleUserDelete,
  sessionUserId,
}: {
  userSearch: string;
  handleUserSearch: (val: string) => Promise<void>;
  roleFilter: "ALL" | "HOST" | "GUEST" | "ADMIN";
  setRoleFilter: React.Dispatch<React.SetStateAction<"ALL" | "HOST" | "GUEST" | "ADMIN">>;
  statusFilter: "ALL" | "PENDING_DELETE" | "ACTIVE" | "DELETED";
  setStatusFilter: React.Dispatch<
    React.SetStateAction<"ALL" | "PENDING_DELETE" | "ACTIVE" | "DELETED">
  >;
  setCreateUserOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filteredUsers: AdminUser[];
  handleRoleChange: (userId: string, newRole: "GUEST" | "HOST" | "ADMIN") => void;
  handleCancelDeletion: (userId: string, name: string) => void;
  handleUserDeleteImmediately: (userId: string, name: string) => void;
  handleUserDelete: (userId: string, name: string) => void;
  sessionUserId?: string;
}) {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <AppInput
          type="text"
          placeholder={tr("searchUsersByNameEmailOrPhone")}
          value={userSearch}
          onChange={(e) => handleUserSearch(e.target.value)}
          style={{ flex: "1 1 200px", padding: "12px 16px" }}
        />

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "ALL" | "HOST" | "GUEST" | "ADMIN")}
          style={{
            ...appInputStyle,
            width: "auto",
            padding: "12px 16px",
            cursor: "pointer",
            minWidth: "130px",
            colorScheme: "dark",
          }}
        >
          <option value="ALL">{tr("allRoles")}</option>
          <option value="ADMIN">{tr("admin")}</option>
          <option value="HOST">{tr("host")}</option>
          <option value="GUEST">{tr("guest")}</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "ALL" | "PENDING_DELETE" | "ACTIVE" | "DELETED")
          }
          style={{
            ...appInputStyle,
            width: "auto",
            padding: "12px 16px",
            cursor: "pointer",
            minWidth: "160px",
            colorScheme: "dark",
          }}
        >
          <option value="ALL">{tr("allStatuses")}</option>
          <option value="ACTIVE">{tr("active")}</option>
          <option value="PENDING_DELETE">{tr("pendingDeletion")}</option>
          <option value="DELETED">{tr("deletedAnonymized")}</option>
        </select>

        <button
          onClick={() => setCreateUserOpen(true)}
          style={{
            backgroundColor: APP_SHELL.accent,
            color: "#fff",
            border: "none",
            borderRadius: APP_SHELL.inputRadius,
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {tr("createUser")}
        </button>
      </div>

      <div
        style={{
          ...appCardStyle,
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: "700px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                  color: APP_SHELL.textSecondary,
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "16px" }}>{tr("user")}</th>
                <th style={{ padding: "16px" }}>{tr("contact")}</th>
                <th style={{ padding: "16px" }}>{tr("role")}</th>
                <th style={{ padding: "16px", textAlign: "right" }}>{tr("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: APP_SHELL.textMuted,
                    }}
                  >
                    {tr("noUsersFound")}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}` }}>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 700, color: APP_SHELL.textPrimary }}>
                        {u.name || tr("unnamedUser")}
                      </div>
                      <div style={{ fontSize: "11px", color: APP_SHELL.textMuted }}>
                        {tr("registeredOn", {
                          date: new Date(u.createdAt).toLocaleDateString(locale),
                        })}
                      </div>
                      {u.deletionScheduledAt && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#ef4444",
                            fontWeight: 600,
                            marginTop: "4px",
                          }}
                        >
                          {tr("deletionRequestedOn")}{" "}
                          {u.deletionRequestedAt
                            ? new Date(u.deletionRequestedAt).toLocaleDateString(locale)
                            : "unknown"}{" "}
                          {tr("scheduledFor")}
                          {new Date(u.deletionScheduledAt).toLocaleDateString(locale)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ color: APP_SHELL.textPrimary }}>{u.email || "-"}</div>
                      <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>
                        {u.phone || "-"}
                      </div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u.id, e.target.value as "GUEST" | "HOST" | "ADMIN")
                        }
                        disabled={u.id === sessionUserId}
                        style={{
                          backgroundColor: APP_SHELL.inputBg,
                          border: `1px solid ${APP_SHELL.inputBorder}`,
                          color: APP_SHELL.textPrimary,
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          outline: "none",
                          colorScheme: "dark",
                          opacity: u.id === sessionUserId ? 0.6 : 1,
                          cursor: u.id === sessionUserId ? "not-allowed" : "default",
                        }}
                      >
                        <option
                          value="GUEST"
                          style={{ backgroundColor: "#12091f", color: "#ffffff" }}
                        >
                          {tr("guest")}
                        </option>
                        <option
                          value="HOST"
                          style={{ backgroundColor: "#12091f", color: "#ffffff" }}
                        >
                          {tr("host")}
                        </option>
                        <option
                          value="ADMIN"
                          style={{ backgroundColor: "#12091f", color: "#ffffff" }}
                        >
                          {tr("admin")}
                        </option>
                      </select>
                    </td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      {u.id === sessionUserId ? (
                        <span
                          style={{
                            color: APP_SHELL.textMuted,
                            fontSize: "13px",
                            fontStyle: "italic",
                          }}
                        >
                          {tr("currentSession")}
                        </span>
                      ) : !u.email &&
                        !u.phone ? null : u // Already Deleted / Anonymized user - show nothing
                        .deletionScheduledAt ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            onClick={() =>
                              handleCancelDeletion(u.id, u.name || u.email || tr("unknownUser"))
                            }
                            style={{
                              backgroundColor: "transparent",
                              border: "1px solid #22c55e",
                              color: "#22c55e",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: "12px",
                              borderRadius: "6px",
                              padding: "4px 10px",
                            }}
                          >
                            {tr("restore")}
                          </button>
                          <button
                            onClick={() =>
                              handleUserDeleteImmediately(
                                u.id,
                                u.name || u.email || tr("unknownUser")
                              )
                            }
                            style={{
                              backgroundColor: "transparent",
                              border: "1px solid #ef4444",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: "12px",
                              borderRadius: "6px",
                              padding: "4px 10px",
                            }}
                          >
                            {tr("deleteNow")}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleUserDelete(u.id, u.name || u.email || tr("unknownUser"))
                          }
                          style={{
                            backgroundColor: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "13px",
                          }}
                        >
                          {tr("delete")}
                        </button>
                      )}
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
