import { describe, it, expect, vi } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import { loadDocs } from "@/lib/docs";

// React.cache passes through in the test environment (no request dedup needed).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

const DOCS_ROOT = path.join(process.cwd(), "docs");

describe("lib/docs.ts", () => {
  it("loads admin docs from docs/admin with frontmatter", async () => {
    const docs = await loadDocs("admin");
    const slugs = docs.map((d) => d.slug).sort();
    expect(slugs).toEqual([
      "admin",
      "configuration",
      "email",
      "installation",
      "local-development",
      "localization",
      "sample-data",
      "sms",
      "upgrading",
    ]);
    for (const doc of docs) {
      expect(doc.audience).toBe("admin");
      expect(doc.locale).toBe("en-US");
      expect(doc.dir).toBe("ltr");
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.category.length).toBeGreaterThan(0);
      expect(doc.content.length).toBeGreaterThan(0);
      // Frontmatter must be stripped from the rendered body.
      expect(doc.content.startsWith("---")).toBe(false);
    }
  });

  it("sorts docs by frontmatter order", async () => {
    const docs = await loadDocs("admin");
    const orders = docs.map((d) => d.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(docs[0].slug).toBe("installation"); // order 10
  });

  it("loads host docs from docs/host", async () => {
    const docs = await loadDocs("host");
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.map((d) => d.slug)).toContain("getting-started");
    expect(docs.every((d) => d.audience === "host")).toBe(true);
    // Host docs carry the required frontmatter just like admin docs.
    for (const doc of docs) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.category.length).toBeGreaterThan(0);
      expect(doc.content.startsWith("---")).toBe(false);
    }
  });

  it("has unique slugs per audience", async () => {
    const docs = await loadDocs("admin");
    const slugs = docs.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("overlays complete Dutch articles without changing canonical identity or order", async () => {
    const english = await loadDocs("host", "en-US");
    const dutch = await loadDocs("host", "nl-NL");
    expect(dutch.map(({ slug, order, audience }) => ({ slug, order, audience }))).toEqual(
      english.map(({ slug, order, audience }) => ({ slug, order, audience }))
    );
    const translated = dutch.find((doc) => doc.slug === "getting-started")!;
    expect(translated.title).toBe("Aan de slag als organisator");
    expect(translated.locale).toBe("nl-NL");
    expect(translated.dir).toBe("ltr");
    const fallback = dutch.find((doc) => doc.slug === "creating-an-event")!;
    expect(fallback).toEqual(english.find((doc) => doc.slug === "creating-an-event"));
  });

  it("keeps locale calls independent and rejects unregistered overlay paths", async () => {
    const dutch = await loadDocs("admin", "nl-NL");
    const english = await loadDocs("admin", "en-US");
    expect(dutch.find((doc) => doc.slug === "sample-data")?.locale).toBe("nl-NL");
    expect(english.every((doc) => doc.locale === "en-US")).toBe(true);
    // Runtime inputs are still allowlisted before any filesystem path is built.
    expect(await loadDocs("admin", "../../host" as "en-US")).toEqual(english);
  });

  // Convention guard: every markdown guide must live in an audience subfolder,
  // never loose in docs/ root (the loader only scans docs/<audience>/).
  it("has no stray markdown files in the docs/ root", () => {
    const rootMarkdown = readdirSync(DOCS_ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name);
    expect(rootMarkdown).toEqual([]);
  });
});
