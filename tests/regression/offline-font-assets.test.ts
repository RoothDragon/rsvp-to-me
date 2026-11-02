// Root cause (November 2026, 01a18e04): next/font/google needed external font
// downloads during production builds, so isolated validation could not finish.
// Validate the complete licensed asset inventory as well as the real build fixture.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/font-files/manifest.json";
import { FONT_OPTIONS } from "@/lib/fonts";

const ROOT = join(__dirname, "../..");
const ASSETS = join(ROOT, "app/font-files");
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

describe("offline font assets", () => {
  it("covers every existing theme and both UI families without extra or missing assets", () => {
    expect(manifest.fonts.map((font) => font.id).sort()).toEqual(
      [...FONT_OPTIONS.map((font) => font.id), "geist-sans", "geist-mono"].sort()
    );
    expect(new Set(manifest.fonts.map((font) => font.id)).size).toBe(14);
    expect(
      readdirSync(ASSETS)
        .filter((name) => name.endsWith(".woff2"))
        .sort()
    ).toEqual(manifest.fonts.map((font) => font.asset).sort());
    for (const name of ["app/fonts.ts", "app/layout.tsx"]) {
      expect(readFileSync(join(ROOT, name), "utf8")).not.toMatch(
        /from\s+["']next\/font\/google["']/
      );
    }
    expect(readFileSync(join(ROOT, "app/layout.tsx"), "utf8")).toContain(
      "geistSans, geistMono, themeFontVariables"
    );
  });

  it("retains the font notices and provenance in production images", () => {
    const dockerfile = readFileSync(join(ROOT, "Dockerfile"), "utf8");
    expect(dockerfile).toContain(
      "COPY --from=builder /app/app/font-files/OFL-*.txt ./licenses/fonts/"
    );
    expect(dockerfile).toContain(
      "COPY --from=builder /app/app/font-files/manifest.json ./licenses/fonts/manifest.json"
    );
    for (const font of manifest.fonts) expect(font.license).toMatch(/^OFL-.+\.txt$/);
  });

  it.each(manifest.fonts)("verifies $family provenance, binary and license integrity", (font) => {
    const bytes = readFileSync(join(ASSETS, font.asset));
    expect(bytes.subarray(0, 4).toString()).toBe("wOF2");
    expect(sha256(bytes)).toBe(font.sha256);
    expect(font.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(font.sourceLicenseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(font.sourceUrl).toContain(
      "/" + manifest.commit + "/" + font.sourceFile.split("/").slice(0, -1).join("/") + "/"
    );
    const license = readFileSync(join(ASSETS, font.license));
    expect(sha256(license)).toBe(font.licenseSha256);
    expect(license.toString().toUpperCase()).toContain("SIL OPEN FONT LICENSE");
    expect(font.glyphCount).toBeGreaterThan(0);
    const axis = font.axes.find((axis) => axis.tag === "wght");
    const weights = font.weight.split(" ").map(Number);
    if (weights.length === 2) {
      expect(axis).toBeDefined();
      expect(weights[0]).toBeGreaterThanOrEqual(axis!.min);
      expect(weights[1]).toBeLessThanOrEqual(axis!.max);
    }
    expect(manifest.conversion.subset).toBe(false);
  });
});
