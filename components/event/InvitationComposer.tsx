"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  previewGuestInvitations,
  sendGuestInvitations,
  getEventEmailPreview,
} from "@/app/actions/event";
import {
  formatInvitationRecipient,
  parseInvitationDraft,
  replaceInvitationSpan,
  type InvitationDraftEntry,
} from "@/lib/invitation-draft";
import type { ResolvedTheme } from "@/lib/theme";
import type {
  InvitationPreviewRecipient,
  ReviewedInvitationRecipient,
} from "@/lib/invitation-types";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { InvitationSpreadsheetImport, type SpreadsheetDraft } from "./InvitationSpreadsheetImport";

type Snapshot = { text: string; spreadsheet: SpreadsheetDraft; importing: boolean };
type Review = { key: string; recipients: InvitationPreviewRecipient[] };
const empty: Snapshot = {
  text: "",
  importing: false,
  spreadsheet: { source: "", mapping: { contactColumn: -1, hasHeader: false } },
};

export function InvitationComposer({
  eventId,
  channelConfig,
  theme,
}: {
  theme?: ResolvedTheme;
  eventId: string;
  channelConfig: { email: boolean; sms: boolean };
}) {
  const locale = useLocale();
  return (
    <InvitationEditor
      key={`${eventId}:${locale}`}
      eventId={eventId}
      channelConfig={channelConfig}
      theme={theme}
    />
  );
}

function InvitationEditor({
  eventId,
  channelConfig,
  theme,
}: {
  theme?: ResolvedTheme;
  eventId: string;
  channelConfig: { email: boolean; sms: boolean };
}) {
  const t = useTranslations("Ui.Event.InvitationComposer");
  const locale = useLocale();
  const [draft, setDraft] = useState<Snapshot>(empty);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const version = useRef(0);
  const [revision, setRevision] = useState(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [review, setReview] = useState<Review | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingCell, setPendingCell] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ contact: string; status: string; error?: string }[]>([]);
  const [filter, setFilter] = useState("all");
  const [previewTarget, setPreviewTarget] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ key: string; subject: string; html: string } | null>(
    null
  );
  const previewRequest = useRef(0);
  const source = useRef<HTMLTextAreaElement>(null);
  const { runWithCaptcha } = useCaptcha();
  const parsed = parseInvitationDraft(draft.text);
  const groups = new Map<string, InvitationDraftEntry[]>();
  parsed.entries.forEach((entry) =>
    groups.set(entry.contact, [...(groups.get(entry.contact) ?? []), entry])
  );
  const duplicates = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  const named = parsed.entries.filter((entry) => entry.name).length;
  const contextKey = JSON.stringify([eventId, locale, revision]);
  const currentReview = review?.key === contextKey ? review : null;
  function invalidate() {
    version.current++;
    setRevision(version.current);
    previewRequest.current++;
    setReview(null);
    setSelected(new Set());
    setPreviewTarget(null);
    setPreview(null);
    setError("");
    setReviewing(false);
  }
  function change(next: Snapshot) {
    setHistory((previous) => [...previous.slice(-99), draft]);
    setDraft(next);
    invalidate();
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous || busy) return;
    setDraft(previous);
    setHistory(history.slice(0, -1));
    invalidate();
  }
  function replace(start: number, end: number, replacement: string) {
    change({
      ...draft,
      text: replaceInvitationSpan(
        draft.text,
        start,
        end,
        replacement,
        draft.text.slice(start, end)
      ),
    });
  }
  function remove(entries: { start: number; end: number }[]) {
    let text = draft.text;
    for (const entry of [...entries].sort((a, b) => b.start - a.start))
      text = replaceInvitationSpan(
        text,
        entry.start,
        entry.end,
        "",
        draft.text.slice(entry.start, entry.end)
      );
    change({ ...draft, text });
  }
  function focusEntry(entry: { start: number; end: number }) {
    source.current?.focus();
    source.current?.setSelectionRange(entry.start, entry.end);
  }
  async function reviewDraft() {
    const requestKey = contextKey;
    const requestVersion = version.current;
    setReviewing(true);
    setError("");
    try {
      const response = await previewGuestInvitations(
        eventId,
        parsed.entries.map(({ contact, name }) => ({ contact, ...(name ? { name } : {}) }))
      );
      if (!active.current || requestVersion !== version.current) return;
      setReview({ key: requestKey, recipients: response.recipients });
      setSelected(
        new Set(
          response.recipients
            .filter(
              (row) =>
                row.disposition === "new" &&
                (row.channel === "EMAIL" ? channelConfig.email : channelConfig.sms)
            )
            .map((row) => row.contact)
        )
      );
    } catch (reason) {
      if (active.current && requestVersion === version.current)
        setError(reason instanceof Error ? reason.message : t("failed"));
    } finally {
      if (active.current && requestVersion === version.current) setReviewing(false);
    }
  }
  async function showPreview(row: InvitationPreviewRecipient) {
    const key = JSON.stringify([version.current, eventId, row.contact, row.guestName, locale]);
    setPreviewTarget(key);
    setPreview(null);
    const request = ++previewRequest.current;
    if (row.channel === "SMS") return;
    try {
      const response = await getEventEmailPreview(eventId, "invite", row.guestName);
      if (
        request === previewRequest.current &&
        key === JSON.stringify([version.current, eventId, row.contact, row.guestName, locale]) &&
        active.current
      )
        setPreview({ key, ...response });
    } catch (reason) {
      if (
        request === previewRequest.current &&
        key === JSON.stringify([version.current, eventId, row.contact, row.guestName, locale]) &&
        active.current
      )
        setError(reason instanceof Error ? reason.message : t("failed"));
    }
  }
  async function send() {
    if (!currentReview || busy || pendingCell || !selected.size) return;
    const recipients: ReviewedInvitationRecipient[] = currentReview.recipients
      .filter((row) => selected.has(row.contact) && row.disposition !== "conflict")
      .map((row) => {
        const entry = parsed.entries.find((entry) => entry.contact === row.contact)!;
        return {
          contact: row.contact,
          ...(entry.name ? { name: entry.name } : {}),
          expectedDisposition:
            row.disposition as ReviewedInvitationRecipient["expectedDisposition"],
          expectedGuestName: row.guestName,
        };
      });
    setBusy(true);
    setError("");
    try {
      const response = await runWithCaptcha("host_invite", (token) =>
        sendGuestInvitations(eventId, recipients, token)
      );
      if (!active.current) return;
      setResults(response.results);
      const succeeded = new Set(
        response.results.filter((row) => row.status === "sent").map((row) => row.contact)
      );
      remove(parsed.entries.filter((entry) => succeeded.has(entry.contact)));
      // Failed contacts stay in the source and require a fresh event review before retry.
      if (!succeeded.size) invalidate();
    } catch (reason) {
      if (!active.current) return;
      invalidate();
      setError(reason instanceof Error ? reason.message : t("failed"));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  const buttonStyle: CSSProperties = {
    padding: "9px 12px",
    border: "1px solid var(--invite-border)",
    borderRadius: "8px",
    background: "var(--invite-input)",
    color: "inherit",
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
    margin: "3px",
    whiteSpace: "normal",
  };
  const primaryStyle: CSSProperties = {
    ...buttonStyle,
    background: theme?.accent ?? "#7c3aed",
    color: theme?.accentFg ?? "white",
    minHeight: "44px",
  };
  const inputStyle = {
    width: "100%",
    padding: "8px",
    border: "1px solid var(--invite-border)",
    borderRadius: "6px",
    color: "inherit",
    background: "var(--invite-input)",
    boxSizing: "border-box" as const,
  };
  return (
    <section
      aria-label={t("composer")}
      style={
        {
          "--invite-border": theme?.inputBorder ?? "#777",
          "--invite-input": theme?.inputBg ?? "#151520",
          display: "grid",
          gap: "14px",
          marginTop: "20px",
          overflowWrap: "anywhere",
          fontSize: "14px",
          lineHeight: 1.5,
        } as CSSProperties
      }
    >
      <h3>{t("composer")}</h3>
      <p>{t("help", { syntaxExample: "Alice Smith <alice@example.com>" })}</p>
      <label>
        {t("source")}
        <textarea
          ref={source}
          value={draft.text}
          disabled={busy}
          rows={5}
          style={inputStyle}
          onChange={(event) => change({ ...draft, text: event.target.value })}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (text.includes("\t")) {
              event.preventDefault();
              change({
                ...draft,
                importing: true,
                spreadsheet: { source: text, mapping: { contactColumn: -1, hasHeader: false } },
              });
            }
          }}
        />
      </label>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button style={buttonStyle} type="button" onClick={undo} disabled={busy || !history.length}>
          {t("undo")}
        </button>
        <button
          style={buttonStyle}
          type="button"
          disabled={busy}
          onClick={() => change({ ...draft, importing: !draft.importing })}
        >
          {t("spreadsheet")}
        </button>
        <label>
          {t("filter")}
          <select
            style={inputStyle}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">{t("all", { count: parsed.entries.length })}</option>
            <option value="named">{t("named", { count: named })}</option>
            <option value="missing">
              {t("missing", { count: parsed.entries.length - named })}
            </option>
          </select>
        </label>
      </div>
      {draft.importing && (
        <InvitationSpreadsheetImport
          draft={draft.spreadsheet}
          disabled={busy}
          onChange={(spreadsheet) => change({ ...draft, spreadsheet })}
          onImport={(text) => change({ ...draft, text, importing: false })}
        />
      )}
      {parsed.issues.map((issue, i) => (
        <div
          key={`${issue.start}-${i}`}
          role="alert"
          style={{ border: "1px solid #e99", padding: "10px" }}
        >
          <strong>
            {t("invalid")}: {t(`issues.${issue.code}`)}
          </strong>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {draft.text.slice(issue.start, issue.end)}
          </pre>
          <button
            style={buttonStyle}
            type="button"
            disabled={busy}
            onClick={() => focusEntry(issue)}
          >
            {t("selectSource")}
          </button>{" "}
          <button
            style={buttonStyle}
            type="button"
            disabled={busy}
            onClick={() => replace(issue.start, issue.end, "")}
          >
            {t("remove")}
          </button>
          {issue.suggestedReplacement !== undefined && (
            <div>
              <p>{t("repairHelp")}</p>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {issue.suggestedReplacement}
              </pre>
              <button
                style={buttonStyle}
                type="button"
                disabled={busy}
                onClick={() => replace(issue.start, issue.end, issue.suggestedReplacement!)}
              >
                {t("repair")}
              </button>
            </div>
          )}
        </div>
      ))}
      {duplicates.map(([contact, rows]) => (
        <div key={contact} role="alert">
          <strong>{t("duplicate", { contact })}</strong>
          <p>{t("duplicateHelp")}</p>
          {rows.map((row, i) => (
            <button
              style={buttonStyle}
              type="button"
              disabled={busy}
              key={row.start}
              onClick={() => remove(rows.filter((other) => other.start !== row.start))}
            >
              {t("keep", { number: i + 1 })}: {row.name || t("noName")}
            </button>
          ))}
          <button style={buttonStyle} type="button" disabled={busy} onClick={() => remove(rows)}>
            {t("removeAll")}
          </button>
        </div>
      ))}
      <div style={{ display: "grid", gap: "10px" }}>
        {parsed.entries
          .filter((row) => filter === "all" || (filter === "named" ? !!row.name : !row.name))
          .map((entry, i) => (
            <div
              key={JSON.stringify([entry.start, entry.end, entry.name, entry.contact])}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                gap: "8px",
                border: "1px solid var(--invite-border)",
                padding: "10px",
                borderRadius: "8px",
              }}
            >
              <label>
                {t("name")}
                <input
                  style={inputStyle}
                  aria-label={`${t("name")} ${i + 1}`}
                  maxLength={100}
                  disabled={busy}
                  defaultValue={entry.name ?? ""}
                  onChange={() => {
                    setPendingCell(true);
                    invalidate();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  onBlur={(event) => {
                    setPendingCell(false);
                    const name = event.target.value;
                    if (name.trim() === (entry.name ?? "")) return;
                    if (!name.trim() || name.trim().length <= 100)
                      replace(
                        entry.start,
                        entry.end,
                        formatInvitationRecipient({
                          contact: entry.contact,
                          ...(name.trim() ? { name } : {}),
                        })
                      );
                  }}
                />
              </label>
              <label>
                {t("contact")}
                <input
                  style={inputStyle}
                  aria-label={`${t("contact")} ${i + 1}`}
                  disabled={busy}
                  defaultValue={entry.contact}
                  onChange={() => {
                    setPendingCell(true);
                    invalidate();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  onBlur={(event) => {
                    setPendingCell(false);
                    if (event.target.value !== entry.contact)
                      replace(
                        entry.start,
                        entry.end,
                        entry.name
                          ? `"${entry.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" <${event.target.value}>`
                          : event.target.value
                      );
                  }}
                />
              </label>
              <div>
                <button
                  style={buttonStyle}
                  type="button"
                  disabled={busy}
                  onClick={() => focusEntry(entry)}
                >
                  {t("selectSource")}
                </button>
                <button
                  style={buttonStyle}
                  type="button"
                  disabled={busy}
                  onClick={() => remove([entry])}
                >
                  {t("remove")}
                </button>
              </div>
            </div>
          ))}
      </div>
      <button
        style={primaryStyle}
        type="button"
        disabled={
          busy ||
          pendingCell ||
          reviewing ||
          !!parsed.issues.length ||
          !!duplicates.length ||
          !parsed.entries.length ||
          draft.importing
        }
        onClick={reviewDraft}
      >
        {reviewing ? t("loading") : t("review")}
      </button>
      {currentReview && (
        <section aria-label={t("review")}>
          <h3>{t("review")}</h3>
          <p>{t("resendHelp")}</p>
          {currentReview.recipients.map((row) => (
            <div
              key={row.contact}
              style={{ borderBottom: "1px solid var(--invite-border)", padding: "10px 0" }}
            >
              <label>
                <input
                  type="checkbox"
                  disabled={
                    busy ||
                    row.disposition === "conflict" ||
                    (row.channel === "EMAIL" ? !channelConfig.email : !channelConfig.sms)
                  }
                  checked={selected.has(row.contact)}
                  onChange={(event) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (event.target.checked) next.add(row.contact);
                      else next.delete(row.contact);
                      return next;
                    })
                  }
                />
                {row.contact} — {t(row.disposition)}
              </label>
              <p>
                {t("effectiveName")}: <strong>{row.guestName}</strong>
              </p>
              {row.disposition !== "new" && <p>{t("preserved")}</p>}
              <button
                style={buttonStyle}
                type="button"
                disabled={busy}
                onClick={() => showPreview(row)}
              >
                {t("preview")}
              </button>
              {previewTarget ===
                JSON.stringify([revision, eventId, row.contact, row.guestName, locale]) && (
                <div>
                  {row.channel === "SMS" ? (
                    <p>
                      {t("smsPreview")}: {row.guestName}
                    </p>
                  ) : (
                    <>
                      <p>{t("language", { locale })}</p>
                      {preview?.key === previewTarget ? (
                        <>
                          <p>{preview.subject}</p>
                          <iframe
                            title={t("preview")}
                            sandbox=""
                            srcDoc={preview.html}
                            style={{
                              width: "100%",
                              height: "400px",
                              border: "1px solid var(--invite-border)",
                              background: "white",
                            }}
                          />
                        </>
                      ) : (
                        <p>{t("loading")}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          <button
            style={primaryStyle}
            type="button"
            disabled={busy || pendingCell || !selected.size}
            onClick={send}
          >
            {busy ? t("sending") : t("send", { count: selected.size })}
          </button>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {!!results.length && (
        <div role="status">
          {results.map((row, i) => (
            <p key={`${row.contact}-${i}`}>
              {row.contact}: {row.status === "sent" ? t("sent") : t("failed")} {row.error}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
