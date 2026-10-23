import type { CSSProperties } from "react";
import type { ResolvedTheme } from "@/lib/theme";

/** The invite dialog is always dark; colors come from CSS variables set by the composer. */
export const inviteVars = (theme?: ResolvedTheme): CSSProperties =>
  ({
    "--invite-border": theme?.inputBorder ?? "rgba(255,255,255,0.16)",
    "--invite-input": theme?.inputBg ?? "rgba(255,255,255,0.06)",
    "--invite-accent": theme?.accent ?? "#7c3aed",
    "--invite-accent-fg": theme?.accentFg ?? "#ffffff",
    "--invite-muted": "rgba(255,255,255,0.62)",
    "--invite-problem": "#fca5a5",
  }) as CSSProperties;

export const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "10px 12px",
  border: "1px solid var(--invite-border)",
  borderRadius: "10px",
  background: "var(--invite-input)",
  color: "inherit",
  font: "inherit",
  boxSizing: "border-box",
};

export const buttonStyle: CSSProperties = {
  padding: "9px 14px",
  minHeight: "40px",
  border: "1px solid var(--invite-border)",
  borderRadius: "10px",
  background: "var(--invite-input)",
  color: "inherit",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
};

export const primaryStyle: CSSProperties = {
  ...buttonStyle,
  minHeight: "44px",
  border: "none",
  background: "var(--invite-accent)",
  color: "var(--invite-accent-fg)",
  fontWeight: 700,
};

/** Primary action styling that also reads as unavailable when disabled. */
export const primary = (disabled: boolean): CSSProperties =>
  disabled ? { ...primaryStyle, opacity: 0.45, cursor: "not-allowed" } : primaryStyle;

export const linkButtonStyle: CSSProperties = {
  padding: "4px 2px",
  border: "none",
  background: "none",
  color: "var(--invite-accent)",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline",
};

export const mutedText: CSSProperties = { color: "var(--invite-muted)", fontSize: "13px" };

export const panelStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "14px",
  border: "1px solid var(--invite-border)",
  borderRadius: "12px",
};

/** Sticky action bar at the bottom of the dialog's scroll area. */
export const footerStyle: CSSProperties = {
  position: "sticky",
  bottom: "-24px",
  margin: "0 -24px -24px",
  padding: "14px 24px 18px",
  background: "rgba(15,15,20,0.98)",
  borderTop: "1px solid var(--invite-border)",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
};
