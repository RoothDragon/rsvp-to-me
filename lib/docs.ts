import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { DEFAULT_LOCALE, locales, resolveLocale, type Locale } from "@/i18n/config";

/**
 * Frontmatter-driven documentation loader for the in-app Documentation portal.
 *
 * Markdown guides live under `docs/<audience>/*.md` (e.g. `docs/admin/`,
 * `docs/host/`) and ship in the production image via the Dockerfile. Each file
 * carries a small YAML frontmatter block:
 *
 *   ---
 *   title: Installation
 *   description: Docker setup, deployment, HTTPS, and troubleshooting.
 *   category: Getting Started
 *   audience: admin
 *   order: 10
 *   ---
 *
 * The sidebar/registry is derived by scanning the folder and reading that
 * frontmatter — there is no hand-maintained list to keep in sync. This module
 * imports `node:fs` and is therefore only usable from Server Components /
 * server actions.
 */

export type DocAudience = "admin" | "host";

export interface LoadedDoc {
  slug: string;
  title: string;
  description: string;
  category: string;
  audience: DocAudience;
  order: number;
  /** Actual article language; an untranslated article falls back as a whole. */
  locale: Locale;
  dir: "ltr" | "rtl";
  /** Markdown body, with the frontmatter block stripped. */
  content: string;
}

const DOCS_ROOT = path.join(process.cwd(), "docs");

/** Minimal YAML frontmatter parser for flat `key: value` blocks (no deps). */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/**
 * Load every doc for an audience, sorted by `order` then title. Returns an empty
 * array if the audience folder does not exist yet (e.g. `docs/host/`).
 */
export const loadDocs = cache(
  async (audience: DocAudience, requestedLocale: Locale = DEFAULT_LOCALE): Promise<LoadedDoc[]> => {
    // Only registered locales can select an overlay directory.
    const locale = resolveLocale(requestedLocale);
    const dir = path.join(DOCS_ROOT, audience);
    let files: string[];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
    } catch {
      return [];
    }

    const docs = await Promise.all(
      files.map(async (file) => {
        const canonical = parseFrontmatter(await readFile(path.join(dir, file), "utf8"));
        let article = canonical;
        let articleLocale: Locale = DEFAULT_LOCALE;
        if (locale !== DEFAULT_LOCALE) {
          try {
            article = parseFrontmatter(
              await readFile(path.join(DOCS_ROOT, "locales", locale, audience, file), "utf8")
            );
            articleLocale = locale;
          } catch (error) {
            // A missing translation falls back; a broken deployment must not be hidden.
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
              throw error;
            }
          }
        }
        const slug = file.replace(/\.md$/, "");
        return {
          // Keep canonical title as the tie-breaker so translation cannot reorder guides.
          canonicalTitle: canonical.data.title || slug,
          article: {
            slug,
            title: article.data.title || slug,
            description: article.data.description || "",
            category: article.data.category || "General",
            audience,
            order: canonical.data.order ? Number(canonical.data.order) : 999,
            locale: articleLocale,
            dir: locales[articleLocale].dir,
            content: article.body,
          } satisfies LoadedDoc,
        };
      })
    );

    docs.sort(
      (a, b) =>
        a.article.order - b.article.order ||
        a.canonicalTitle.localeCompare(b.canonicalTitle, "en-US")
    );
    return docs.map(({ article }) => article);
  }
);
