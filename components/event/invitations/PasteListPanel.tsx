"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { parseInvitationPaste, type PastedRecipient } from "@/lib/invitation-paste";
import { buttonStyle, inputStyle, mutedText, panelStyle, primary } from "./styles";

export function PasteListPanel({
  onAdd,
  onCancel,
  onSpreadsheetPaste,
}: {
  onAdd: (recipients: PastedRecipient[]) => void;
  onCancel: () => void;
  onSpreadsheetPaste: (text: string) => void;
}) {
  const t = useTranslations("Ui.Event.InvitationComposer");
  const [text, setText] = useState("");
  const pasted = parseInvitationPaste(text);
  const count = pasted.rows.length;
  return (
    <section aria-label={t("pasteList")} style={panelStyle}>
      <label style={{ display: "grid", gap: "6px" }}>
        <strong>{t("pasteListLabel")}</strong>
        <span style={mutedText}>
          {t("pasteListHelp", { example: "Alex Rivera <alex@example.com>" })}
        </span>
        <textarea
          autoFocus
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData("text");
            if (pastedText.includes("\t")) {
              event.preventDefault();
              onSpreadsheetPaste(pastedText);
            }
          }}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>
      <p role="status" style={{ ...mutedText, margin: 0 }}>
        {pasted.tooLong ? t("tooLong") : t("found", { count })}
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          style={primary(!count)}
          disabled={!count}
          onClick={() => onAdd(pasted.rows)}
        >
          {t("addFound", { count })}
        </button>
        <button type="button" style={buttonStyle} onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </section>
  );
}
