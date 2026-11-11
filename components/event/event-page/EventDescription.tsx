"use client";

import { useId, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { eventDescriptionPreview, eventDescriptionText } from "@/lib/event-description";
import { DescriptionEditor, DescriptionMarkup } from "../DescriptionEditor";
import styles from "../Description.module.css";

export function EventDescription({
  value,
  isHost,
  onSave,
  outerRef,
}: {
  value: string;
  isHost: boolean;
  onSave: (value: string) => void;
  outerRef?: RefObject<HTMLSpanElement | null>;
}) {
  const tr = useTranslations("Ui.EventDescription");
  const common = useTranslations("Ui.Common");
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const text = eventDescriptionText(value);
  const preview = eventDescriptionPreview(value);
  const long = preview.truncated;
  if (editing)
    return (
      <div>
        <DescriptionEditor value={draft} onChange={setDraft} autoFocus />
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              if (draft !== value) onSave(draft);
              setEditing(false);
            }}
          >
            {common("save")}
          </button>
          <button type="button" className={styles.button} onClick={() => setEditing(false)}>
            {common("cancel")}
          </button>
        </div>
      </div>
    );
  return (
    <div>
      <div id={id}>
        {!text ? (
          <p>{tr("empty")}</p>
        ) : long && !expanded ? (
          <>
            <DescriptionMarkup value={preview.html} />
            <span aria-hidden="true">…</span>
          </>
        ) : (
          <DescriptionMarkup value={value} />
        )}
      </div>
      <div className={styles.controls}>
        {long && (
          <button
            type="button"
            className={styles.button}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? tr("collapse") : tr("expand")}
          </button>
        )}
        {isHost && (
          <span ref={outerRef}>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setDraft(value);
                setEditing(true);
              }}
            >
              {tr("edit")}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
