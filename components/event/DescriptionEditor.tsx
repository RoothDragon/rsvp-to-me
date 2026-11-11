"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { sanitizeEventDescription } from "@/lib/event-description";
import styles from "./Description.module.css";

export function DescriptionMarkup({ value }: { value: string }) {
  return (
    <div
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: sanitizeEventDescription(value) }}
    />
  );
}

export function DescriptionEditor({
  name,
  value,
  onChange,
  placeholder,
  autoFocus = false,
}: {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const tr = useTranslations("Ui.EventDescription");
  const id = useId();
  const [localValue, setLocalValue] = useState("");
  const [preview, setPreview] = useState(false);
  const text = value ?? localValue;
  return (
    <div>
      <textarea
        name={name}
        value={text}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange?.(e.target.value);
        }}
        aria-label={tr("label")}
        aria-describedby={`${id}-help`}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={6}
        maxLength={10000}
        className={styles.editor}
        hidden={preview}
        style={{ resize: "both", ...(preview ? { display: "none" } : {}) }}
      />
      {preview && (
        <section aria-label={tr("preview")}>
          <DescriptionMarkup value={text} />
        </section>
      )}
      <p id={`${id}-help`} className={styles.hint}>
        {tr("help")}
      </p>
      <button
        type="button"
        className={styles.button}
        aria-pressed={preview}
        onClick={() => setPreview(!preview)}
      >
        {preview ? tr("editText") : tr("preview")}
      </button>
    </div>
  );
}
