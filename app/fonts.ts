// Repository-owned web fonts: builds and visitors never fetch fonts from Google.
// Keep CSS variables aligned with the pure-data registry in lib/fonts.ts.
// Theme faces are not preloaded; the two base UI faces retain preloading.
// Pinned provenance, licenses, glyph coverage and checksums: font-files/manifest.json.
import localFont from "next/font/local";

export const geistSans = localFont({
  src: "./font-files/geist-sans-normal.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: true,
});

export const geistMono = localFont({
  src: "./font-files/geist-mono-normal.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: true,
});

const playfair = localFont({
  src: "./font-files/playfair-normal.woff2",
  variable: "--font-playfair",
  weight: "400 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  preload: false,
});

const dmSerif = localFont({
  src: "./font-files/dm-serif-normal.woff2",
  variable: "--font-dm-serif",
  weight: "400",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  preload: false,
});

const lora = localFont({
  src: "./font-files/lora-normal.woff2",
  variable: "--font-lora",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  preload: false,
});

const bebas = localFont({
  src: "./font-files/bebas-normal.woff2",
  variable: "--font-bebas",
  weight: "400",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const righteous = localFont({
  src: "./font-files/righteous-normal.woff2",
  variable: "--font-righteous",
  weight: "400",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const fredoka = localFont({
  src: "./font-files/fredoka-normal.woff2",
  variable: "--font-fredoka",
  weight: "300 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const pacifico = localFont({
  src: "./font-files/pacifico-normal.woff2",
  variable: "--font-pacifico",
  weight: "400",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const dancingScript = localFont({
  src: "./font-files/dancing-script-normal.woff2",
  variable: "--font-dancing-script",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const caveat = localFont({
  src: "./font-files/caveat-normal.woff2",
  variable: "--font-caveat",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const roboto = localFont({
  src: "./font-files/roboto-normal.woff2",
  variable: "--font-roboto",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const spaceGrotesk = localFont({
  src: "./font-files/space-grotesk-normal.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const outfit = localFont({
  src: "./font-files/outfit-normal.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

/** Class string exposing every event-theme font variable, applied on <html>. */
export const themeFontVariables = [
  playfair,
  dmSerif,
  lora,
  bebas,
  righteous,
  fredoka,
  pacifico,
  dancingScript,
  caveat,
  roboto,
  spaceGrotesk,
  outfit,
]
  .map((font) => font.variable)
  .join(" ");
