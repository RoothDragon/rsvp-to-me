"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail, MessageSquare } from "lucide-react";
import { getEventEmailPreview } from "@/app/actions/event";
import type { InvitationPreviewRecipient } from "@/lib/invitation-types";
import { linkButtonStyle, mutedText } from "./styles";

const GROUPS = ["new", "invited", "responded", "conflict"] as const;

export function ReviewStep({
  eventId,
  reviewKey,
  recipients,
  selected,
  onToggle,
  disabled,
}: {
  eventId: string;
  /** Identifies the reviewed draft; previews for an older review are dropped. */
  reviewKey: string;
  recipients: InvitationPreviewRecipient[];
  selected: Set<string>;
  onToggle: (contact: string, checked: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("Ui.Event.InvitationComposer");
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ key: string; subject: string; html: string } | null>(
    null
  );
  const [error, setError] = useState("");
  const request = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function togglePreview(row: InvitationPreviewRecipient) {
    const id = ++request.current;
    setPreview(null);
    setError("");
    if (open === row.contact) {
      setOpen(null);
      return;
    }
    setOpen(row.contact);
    if (row.channel === "SMS") return;
    const key = JSON.stringify([reviewKey, row.contact, row.guestName, locale]);
    try {
      const response = await getEventEmailPreview(eventId, "invite", row.guestName);
      if (active.current && id === request.current) setPreview({ key, ...response });
    } catch (reason) {
      if (active.current && id === request.current)
        setError(reason instanceof Error ? reason.message : t("failed"));
    }
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      {GROUPS.map((group) => {
        const rows = recipients.filter((row) => row.disposition === group);
        if (!rows.length) return null;
        return (
          <section key={group} aria-label={t(`groups.${group}`)}>
            <h4 style={{ margin: "0 0 4px", fontSize: "15px" }}>
              {t(`groups.${group}`)} · {rows.length}
            </h4>
            {group !== "new" && (
              <p style={{ ...mutedText, margin: "0 0 8px" }}>{t(`groupHelp.${group}`)}</p>
            )}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "8px" }}>
              {rows.map((row) => {
                const previewOpen = open === row.contact;
                const channel =
                  row.channel === "EMAIL" ? (
                    <Mail size={14} aria-label={t("channelEmail")} />
                  ) : (
                    <MessageSquare size={14} aria-label={t("channelSms")} />
                  );
                const identity = (
                  <span style={{ display: "grid", minWidth: 0 }}>
                    <strong style={{ overflowWrap: "anywhere" }}>{row.guestName}</strong>
                    <span
                      style={{
                        ...mutedText,
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {channel}
                      {row.contact}
                    </span>
                  </span>
                );
                return (
                  <li
                    key={row.contact}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid var(--invite-border)",
                      borderRadius: "10px",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    {group === "conflict" ? (
                      identity
                    ) : (
                      <label style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <input
                          type="checkbox"
                          style={{ marginTop: "4px", width: "18px", height: "18px" }}
                          disabled={disabled}
                          checked={selected.has(row.contact)}
                          onChange={(event) => onToggle(row.contact, event.target.checked)}
                        />
                        {identity}
                      </label>
                    )}
                    <div
                      style={{
                        ...mutedText,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      {/* New guests are greeted by the name shown above; existing ones keep theirs. */}
                      {group !== "new" && group !== "conflict" && (
                        <span>
                          {t("greeting", { name: row.guestName })} · {t("nameKept")}
                        </span>
                      )}
                      {group !== "conflict" && (
                        <button
                          type="button"
                          style={linkButtonStyle}
                          aria-expanded={previewOpen}
                          onClick={() => togglePreview(row)}
                        >
                          {previewOpen ? t("hidePreview") : t("preview")}
                        </button>
                      )}
                    </div>
                    {previewOpen &&
                      (row.channel === "SMS" ? (
                        <p style={{ ...mutedText, margin: 0 }}>
                          {t("smsPreview", { name: row.guestName })}
                        </p>
                      ) : error ? (
                        <p role="alert" style={{ margin: 0, color: "var(--invite-problem)" }}>
                          {error}
                        </p>
                      ) : preview?.key ===
                        JSON.stringify([reviewKey, row.contact, row.guestName, locale]) ? (
                        <div style={{ display: "grid", gap: "6px" }}>
                          <p style={{ ...mutedText, margin: 0 }}>
                            {t("language", { locale })} · {preview.subject}
                          </p>
                          <iframe
                            title={t("previewTitle", { name: row.guestName })}
                            sandbox=""
                            srcDoc={preview.html}
                            style={{
                              width: "100%",
                              height: "420px",
                              border: "1px solid var(--invite-border)",
                              borderRadius: "8px",
                              background: "white",
                            }}
                          />
                        </div>
                      ) : (
                        <p style={{ ...mutedText, margin: 0 }}>{t("loading")}</p>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
