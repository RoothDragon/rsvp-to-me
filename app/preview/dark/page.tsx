"use client";
import { useTranslations } from "next-intl";

import { resolveTheme } from "@/lib/theme";

export default function DarkPreview() {
  const tr = useTranslations("Ui.Preview");

  const accent = "#a855f7"; // purple
  const secondary = "#ec4899"; // pink
  const t = resolveTheme("DARK", accent, secondary, accent);

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: t.pageBg, color: t.textPrimary }}
    >
      {/* Animated glow orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "30%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: t.pageDecorationBg1,
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "-10%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: t.pageDecorationBg2,
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[600px] mx-auto px-4 py-12">
        {/* Cover image placeholder */}
        <div
          className="w-full rounded-2xl mb-8 flex items-center justify-center"
          style={{
            height: "260px",
            background: t.avatarGradient,
            boxShadow: t.accentShadow,
          }}
        >
          <span style={{ fontSize: "72px" }}>🍷</span>
        </div>

        {/* Date badge */}
        <div className="flex items-center gap-2 mb-3">
          {tr.rich("fridayJune27800PmMessage", {
            part0: (chunks) => (
              <span
                className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  background: t.badgeBg,
                  color: t.badgeText,
                  border: `1px solid ${t.accentBorder}`,
                }}
              >
                {chunks}
              </span>
            ),
            part1: (chunks) => (
              <span
                className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  background: t.badgeBg,
                  color: t.badgeText,
                  border: `1px solid ${t.accentBorder}`,
                }}
              >
                {chunks}
              </span>
            ),
          })}
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-bold mb-2"
          style={{ letterSpacing: "-0.02em", fontFamily: t.headingFont }}
        >
          {tr("wineNight")}
        </h1>

        {/* Host */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: t.avatarGradient, color: t.accentFg }}
          >
            {tr("j")}
          </div>
          <span style={{ color: t.textSecondary }}>{tr("hostedByJoe")}</span>
        </div>

        {/* Location */}
        <div
          className="flex items-start gap-3 mb-8 p-4 rounded-xl"
          style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}
        >
          <span style={{ color: t.accent, fontSize: "18px" }}>📍</span>
          <div>
            <div className="font-medium">{tr("joeSPlace")}</div>
            <div style={{ color: t.textMuted, fontSize: "14px" }}>{tr("123MainStBrooklynNy")}</div>
          </div>
        </div>

        {/* Description */}
        <p className="mb-8 leading-relaxed" style={{ color: t.textSecondary }}>
          {tr("monthlyWineNightAtMyPlaceBringABottle")}
        </p>

        {/* RSVP Card */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.accentBorder}`,
            backdropFilter: "blur(12px)",
            boxShadow: t.cardShadow,
          }}
        >
          <h2 className="text-lg font-semibold mb-4">{tr("areYouComing")}</h2>
          <div className="flex gap-3 mb-5">
            {[
              { label: tr("going"), emoji: "🎉", active: true },
              { label: tr("maybe"), emoji: "🤔", active: false },
              { label: tr("canTGo"), emoji: "😔", active: false },
            ].map((opt) => (
              <button
                key={opt.label}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={
                  opt.active
                    ? {
                        background: t.accent,
                        color: t.accentFg,
                        boxShadow: t.accentShadow,
                        border: "none",
                      }
                    : {
                        background: t.inputBg,
                        color: t.textSecondary,
                        border: `1px solid ${t.inputBorder}`,
                      }
                }
              >
                <div>{opt.emoji}</div>
                <div style={{ fontSize: "11px", marginTop: "2px" }}>{opt.label}</div>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <input
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              placeholder={tr("yourName")}
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.inputText,
              }}
            />
            <input
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              placeholder={tr("emailOptionalForUpdates")}
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.inputText,
              }}
            />
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{
                background: t.accent,
                color: t.accentFg,
                boxShadow: t.accentShadow,
                border: "none",
              }}
            >
              {tr("sendRsvp")}
            </button>
          </div>
        </div>

        {/* Guest list */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{tr("going8")}</h3>
            <span style={{ color: t.textMuted, fontSize: "13px" }}>{tr("3Maybe")}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Sarah", "Mike", "Emma", "James", "Priya", "Tom", "Leila", "Raj"].map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                style={{
                  background: t.pillBg,
                  border: `1px solid ${t.pillBorder}`,
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: t.avatarGradient, color: t.accentFg }}
                >
                  {name[0]}
                </div>
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          <h3 className="font-semibold mb-4">{tr("vibes")}</h3>
          <div className="space-y-3 mb-4">
            {[
              {
                name: "Sarah",
                msg: tr("cannotWaitBringingAPinotIVeBeenSaving"),
                time: tr("2hAgo"),
              },
              { name: "Mike", msg: tr("yesBringingSomethingFromBurgundy"), time: tr("1hAgo") },
            ].map((c) => (
              <div key={c.name} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: t.avatarGradient, color: t.accentFg }}
                >
                  {c.name[0]}
                </div>
                <div
                  className="flex-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span style={{ color: t.textMuted, fontSize: "11px", marginLeft: "8px" }}>
                    {c.time}
                  </span>
                  <p style={{ color: t.textSecondary, marginTop: "2px" }}>{c.msg}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              placeholder={tr("saySomething")}
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.inputText,
              }}
            />
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: t.accentBg,
                color: t.accent,
                border: `1px solid ${t.accentBorder}`,
              }}
            >
              {tr("post")}
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-xs" style={{ color: t.textMuted }}>
          {tr("rsvpToMe")}
        </p>
      </div>
    </div>
  );
}
