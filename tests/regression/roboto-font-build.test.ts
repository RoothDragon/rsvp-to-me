// October 2026, PR #699: Google returned extensionless Roboto URLs with embedded
// '&' parameters. Next 16.3's Google loader misparsed them as multiple queries,
// failing the AMD64 Turbopack image build. Exercise the actual theme-font module
// with that response shape and verify the bundled font reaches production CSS.
// November 2026, 01a18e04: all remaining Google families also broke isolated
// builds. Build every real font with an empty Google-response map (fail closed).

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const requireFromRoot = createRequire(join(ROOT, "package.json"));

it("builds every theme and UI font without Google responses", () => {
  const scratch = join(ROOT, ".vitest");
  mkdirSync(scratch, { recursive: true });
  const fixture = mkdtempSync(join(scratch, "roboto-font-"));
  try {
    mkdirSync(join(fixture, "app", "font-files"), { recursive: true });
    copyFileSync(join(ROOT, "app", "fonts.ts"), join(fixture, "app", "fonts.ts"));
    const asset = readFileSync(join(ROOT, "app", "font-files", "roboto-normal.woff2"));
    const fontFiles = readdirSync(join(ROOT, "app", "font-files")).filter((name) =>
      name.endsWith(".woff2")
    );
    for (const name of fontFiles) {
      copyFileSync(join(ROOT, "app", "font-files", name), join(fixture, "app", "font-files", name));
    }
    writeFileSync(join(fixture, "package.json"), JSON.stringify({ private: true }));
    writeFileSync(
      join(fixture, "next.config.js"),
      `module.exports = ${JSON.stringify({
        turbopack: { root: ROOT },
        experimental: { cpus: 1 },
      })};`
    );
    writeFileSync(
      join(fixture, "app", "layout.tsx"),
      `
      import type { ReactNode } from "react";
      import { geistSans, geistMono, themeFontVariables } from "./fonts";
      export default function Layout({ children }: { children: ReactNode }) {
        return <html className={[geistSans.variable, geistMono.variable, themeFontVariables].join(" ")}><body>{children}</body></html>;
      }
    `
    );
    writeFileSync(
      join(fixture, "app", "page.tsx"),
      `
      export default function Page() {
        return <h1 style={{ fontFamily: "var(--font-roboto)" }}>Roboto</h1>;
      }
    `
    );
    const mockedResponses = join(fixture, "google-responses.cjs");
    // An unexpected next/font/google request has no canned response and fails.
    writeFileSync(mockedResponses, "module.exports = {};\n");

    const build = spawnSync(
      process.execPath,
      [requireFromRoot.resolve("next/dist/bin/next"), "build", fixture],
      {
        cwd: fixture,
        encoding: "utf8",
        timeout: 60000,
        env: {
          ...process.env,
          NODE_ENV: "production",
          NEXT_TELEMETRY_DISABLED: "1",
          NEXT_FONT_GOOGLE_MOCKED_RESPONSES: mockedResponses,
        },
      }
    );
    expect(build.status, `${build.error ?? ""}\n${build.stdout}\n${build.stderr}`).toBe(0);
    expect(build.stdout).toContain("(Turbopack)");

    const staticDir = join(fixture, ".next", "static");
    const emitted = readdirSync(staticDir, { recursive: true, encoding: "utf8" }).map((path) =>
      join(staticDir, path)
    );
    const styles = emitted
      .filter((path) => path.endsWith(".css"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(styles).toContain("--font-roboto");
    expect(styles).toMatch(/font-weight:\s*400 700/);
    expect(styles).toMatch(/font-display:\s*swap/);
    expect(
      emitted
        .filter((path) => path.endsWith(".woff2"))
        .some((path) => readFileSync(path).equals(asset))
    ).toBe(true);
    const html = readFileSync(join(fixture, ".next", "server", "app", "index.html"), "utf8");
    const preloads = html.match(/<link[^>]+as="font"[^>]*>/g) ?? [];
    expect(preloads).toHaveLength(2);
    for (const id of ["geist-sans", "geist-mono"]) {
      const bytes = readFileSync(join(ROOT, "app", "font-files", id + "-normal.woff2"));
      const emittedPath = emitted.find(
        (path) => path.endsWith(".woff2") && readFileSync(path).equals(bytes)
      );
      expect(emittedPath).toBeDefined();
      expect(preloads.some((link) => link.includes(basename(emittedPath!)))).toBe(true);
    }
    for (const name of fontFiles) {
      const bytes = readFileSync(join(ROOT, "app", "font-files", name));
      expect(
        emitted.some((path) => path.endsWith(".woff2") && readFileSync(path).equals(bytes)),
        name
      ).toBe(true);
    }
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "app", "font-files", "manifest.json"), "utf8")
    ) as { fonts: { id: string }[] };
    for (const font of manifest.fonts) expect(styles).toContain("--font-" + font.id);
  } finally {
    // Windows can retain brief build-file locks after the Next subprocess exits.
    rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 75000);
