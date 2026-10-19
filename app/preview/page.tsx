import { getRequestTranslator } from "@/i18n/server";
import Link from "next/link";

export default async function PreviewIndex() {
  const tr = await getRequestTranslator();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#fafafa" }}
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">{tr("Ui.Preview.stylePreviews")}</h1>
        <p className="text-sm mb-8" style={{ color: "#71717a" }}>
          {tr("Ui.Preview.pickTheVibeForRsvpToMe")}
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          {[
            {
              href: "/preview/dark",
              label: tr("Ui.Preview.darkMoody"),
              desc: tr("Ui.Preview.deepDarkGlowingPurples"),
            },
            {
              href: "/preview/soft",
              label: tr("Ui.Preview.softDreamy"),
              desc: tr("Ui.Preview.pastelsBlurredGradients"),
            },
            {
              href: "/preview/bold",
              label: tr("Ui.Preview.boldColorful"),
              desc: tr("Ui.Preview.highContrastCleanCard"),
            },
          ].map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block w-52 p-5 rounded-2xl border text-left hover:shadow-md transition-shadow"
              style={{ background: "#fff", border: "1px solid #e4e4e7" }}
            >
              <div className="text-lg mb-1">{s.label}</div>
              <div className="text-sm" style={{ color: "#71717a" }}>
                {s.desc}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
