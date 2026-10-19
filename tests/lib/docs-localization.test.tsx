import React from "react";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { describe, expect, it, vi } from "vitest";
import { loadDocs } from "@/lib/docs";
import remarkCanonicalHeadings from "@/lib/remark-canonical-headings";
import DocsPanel from "@/components/docs/DocsPanel";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import { locales, type Locale } from "@/i18n/config";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

function renderMarkdown(content: string) {
  return renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCanonicalHeadings]}
      rehypePlugins={[rehypeSlug]}
    >
      {content}
    </ReactMarkdown>
  );
}

function headingIds(content: string) {
  return [...renderMarkdown(content).matchAll(/<h[1-6] id="([^"]+)"/g)].map((match) => match[1]);
}

function linkTargets(content: string) {
  return [...renderMarkdown(content).matchAll(/<a href="([^"]+)"/g)].map((match) => match[1]);
}

describe("localized documentation integrity", () => {
  it("keeps every overlay's canonical headings, links, code blocks and image targets", async () => {
    for (const locale of Object.keys(locales) as Locale[]) {
      if (locale === "en-US") continue;
      for (const audience of ["admin", "host"] as const) {
        const englishDocs = await loadDocs(audience, "en-US");
        const docs = await loadDocs(audience, locale);
        const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
        const overlayDir = path.join(process.cwd(), "docs", "locales", locale, audience);
        if (existsSync(overlayDir)) {
          for (const file of readdirSync(overlayDir).filter((name) => name.endsWith(".md"))) {
            expect(bySlug.has(file.replace(/\.md$/, "")), `${locale}/${audience}/${file}`).toBe(
              true
            );
          }
        }
        for (const doc of docs.filter((article) => article.locale !== "en-US")) {
          const canonical = englishDocs.find((article) => article.slug === doc.slug)!;
          const ids = headingIds(doc.content);
          expect(ids, `${locale}/${audience}/${doc.slug} headings`).toEqual(
            headingIds(canonical.content)
          );
          expect(new Set(ids).size).toBe(ids.length);
          expect(linkTargets(doc.content), `${doc.slug} link targets`).toEqual(
            linkTargets(canonical.content)
          );
          const blocks = (content: string) => content.match(/```[^\n]*\n[\s\S]*?```/g) ?? [];
          expect(blocks(doc.content), `${doc.slug} code blocks`).toEqual(blocks(canonical.content));
          const images = (content: string) =>
            [...renderMarkdown(content).matchAll(/<img[^>]+src="([^"]+)"/g)].map(
              (match) => match[1]
            );
          expect(images(doc.content), `${doc.slug} image targets`).toEqual(
            images(canonical.content)
          );
          for (const target of linkTargets(doc.content)) {
            if (/^(?:[a-z]+:|\/)/i.test(target)) continue;
            const [targetPath, hash] = target.split("#");
            const slug = targetPath ? path.basename(targetPath, ".md") : doc.slug;
            const destination = bySlug.get(slug);
            expect(destination, `${doc.slug}: ${target}`).toBeDefined();
            if (hash)
              expect(headingIds(destination!.content), `${doc.slug}: ${target}`).toContain(hash);
          }
        }
      }
    }
  });

  it("packages locale overlays through the existing recursive Docker docs copy", () => {
    const dockerfile = readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/COPY --from=builder \/app\/docs \.\/docs/);
    expect(existsSync(path.join(process.cwd(), "docs/locales/nl-NL/admin/localization.md"))).toBe(
      true
    );
  });

  it("preserves explicit safe anchors and ignores attribute injection or raw HTML", () => {
    const html = renderMarkdown(
      '## Inloggen {#signing-in}\n\n## Unsafe {#x" onclick="bad}\n\n<script>alert(1)</script>'
    );
    expect(html).toContain('<h2 id="signing-in">Inloggen</h2>');
    expect(html).not.toContain('onclick="bad"');
    expect(html).not.toContain("<script>");
  });

  it("renders translated navigation but marks an English fallback article English/LTR", async () => {
    const fallback = (await loadDocs("host", "nl-NL")).find(
      (doc) => doc.slug === "creating-an-event"
    )!;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="nl-NL"
        messages={{ Ui: { Docs: dutch.Ui.Docs } }}
        timeZone="UTC"
      >
        <DocsPanel docs={[fallback]} />
      </NextIntlClientProvider>
    );
    expect(html).toContain('placeholder="Handleidingen doorzoeken…"');
    expect(html).toContain('class="md-body" lang="en-US" dir="ltr"');
    expect(html).toContain("Creating Your Event");
  });

  it("preserves a fixture article's RTL language independently from the UI locale", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en-US"
        messages={{ Ui: { Docs: english.Ui.Docs } }}
        timeZone="UTC"
      >
        <DocsPanel
          docs={[
            {
              slug: "fixture",
              title: "دليل",
              description: "مساعدة",
              category: "Guide",
              content: "## مرحبا {#welcome}",
              locale: "ar",
              dir: "rtl",
            },
          ]}
        />
      </NextIntlClientProvider>
    );
    expect(html).toContain('class="md-body" lang="ar" dir="rtl"');
    expect(html).toContain('<h2 id="welcome">مرحبا</h2>');
  });
});
