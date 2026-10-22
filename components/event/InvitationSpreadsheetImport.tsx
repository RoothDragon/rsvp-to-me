"use client";

import { useTranslations } from "next-intl";
import {
  importInvitationSpreadsheet,
  parseInvitationSpreadsheet,
  type InvitationSpreadsheetMapping,
} from "@/lib/invitation-spreadsheet";

export interface SpreadsheetDraft {
  source: string;
  mapping: InvitationSpreadsheetMapping;
}
export function InvitationSpreadsheetImport({
  draft,
  onChange,
  onImport,
  disabled,
}: {
  draft: SpreadsheetDraft;
  onChange: (draft: SpreadsheetDraft) => void;
  onImport: (text: string) => void;
  disabled: boolean;
}) {
  const controlStyle = {
    padding: "9px",
    border: "1px solid var(--invite-border)",
    borderRadius: "8px",
    background: "var(--invite-input)",
    color: "inherit",
    font: "inherit",
  };
  const t = useTranslations("Ui.Event.InvitationComposer");
  const parsed = parseInvitationSpreadsheet(draft.source);
  const result = importInvitationSpreadsheet(draft.source, draft.mapping);
  const columns = Math.max(0, ...parsed.rows.map((row) => row.length));
  return (
    <section aria-label={t("spreadsheet")}>
      <h3>{t("spreadsheet")}</h3>
      <label>
        {t("pasteTable")}
        <textarea
          disabled={disabled}
          value={draft.source}
          onChange={(e) => onChange({ ...draft, source: e.target.value })}
          rows={4}
          style={{ ...controlStyle, width: "100%" }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={draft.mapping.hasHeader}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...draft, mapping: { ...draft.mapping, hasHeader: e.target.checked } })
          }
        />
        {t("header")}
      </label>
      <p>{t("mappingHelp")}</p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {Array.from({ length: columns }, (_, col) => (
                <th key={col}>
                  <label>
                    {t("column", { number: col + 1 })}
                    <select
                      style={controlStyle}
                      disabled={disabled}
                      value={
                        draft.mapping.contactColumn === col
                          ? "contact"
                          : draft.mapping.nameColumn === col
                            ? "name"
                            : "ignore"
                      }
                      onChange={(e) => {
                        const mapping = { ...draft.mapping };
                        if (mapping.contactColumn === col) mapping.contactColumn = -1;
                        if (mapping.nameColumn === col) delete mapping.nameColumn;
                        if (e.target.value === "contact") mapping.contactColumn = col;
                        if (e.target.value === "name") mapping.nameColumn = col;
                        onChange({ ...draft, mapping });
                      }}
                    >
                      <option value="ignore">{t("ignore")}</option>
                      <option value="name">{t("name")}</option>
                      <option value="contact">{t("contact")}</option>
                    </select>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.slice(0, 5).map((row, i) => (
              <tr key={i}>
                {row.map((cell, col) => (
                  <td key={col}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft.source && result.issues.length > 0 && (
        <div role="status">
          <p>{t("tableErrors", { count: result.issues.length })}</p>
          {result.issues.map((issue, i) => (
            <p key={i}>
              {issue.row !== undefined && t("row", { number: issue.row + 1 })}{" "}
              {issue.column !== undefined && t("column", { number: issue.column + 1 })}:{" "}
              {t(`issues.${issue.code}`)}
            </p>
          ))}
        </div>
      )}
      <button
        style={controlStyle}
        type="button"
        disabled={
          disabled || !draft.source || result.issues.length > 0 || !result.recipients.length
        }
        onClick={() => onImport(result.text)}
      >
        {t("import")}
      </button>
    </section>
  );
}
