import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import english from "../../messages/en-US.json";
import dutch from "../../messages/nl-NL.json";
import german from "../../messages/de-DE.json";
import spanish from "../../messages/es-ES.json";
import locales from "../../messages/locales.json";
import { PASSWORD_EVENT_SLUG, PRIVATE_EVENT_SLUG, PUBLIC_EVENT_SLUG } from "./fixtures";

const LOCALE_COOKIE = "rsvp-locale";
const SESSION_COOKIE = "rsvp-session";
type Locale = keyof typeof locales;
const catalogs = [english, dutch, german, spanish];
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const choiceName = new RegExp(
  `^(${catalogs.map((catalog) => escapeRegex(catalog.Ui.Language.choose)).join("|")})$`
);
const profileName = new RegExp(
  `^(${catalogs
    .flatMap((catalog) => [catalog.Ui.Navigation.openProfile, catalog.Ui.Navigation.openMenu])
    .map(escapeRegex)
    .join("|")})$`
);

function header(page: Page) {
  return page.locator("nav").filter({ has: page.getByRole("button", { name: choiceName }) });
}

async function chooseLanguage(page: Page, locale: Locale, scope = header(page)) {
  await scope.getByRole("button", { name: choiceName }).click();
  await scope.getByRole("menuitemradio", { name: locales[locale].nativeName, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find((cookie) => cookie.name === LOCALE_COOKIE)?.value
    )
    .toBe(locale);
}

async function expectHeader(page: Page, locale: Locale = "en-US") {
  const nav = header(page);
  await expect(nav).toHaveCount(1);
  const language = nav.getByRole("button", { name: choiceName });
  const profile = nav.getByRole("button", { name: profileName });
  await expect(language).toBeVisible();
  await expect(profile).toBeVisible();
  await expect(language).toHaveText(locale.split("-")[0].toUpperCase());
  await expect(language.locator("svg")).toBeVisible();
  const languageBounds = (await language.boundingBox())!;
  const profileBounds = (await profile.boundingBox())!;
  expect(languageBounds.width).toBeGreaterThanOrEqual(44);
  expect(languageBounds.height).toBeGreaterThanOrEqual(44);
  expect(languageBounds.x + languageBounds.width).toBeLessThanOrEqual(profileBounds.x + 1);
  expect(profileBounds.x - languageBounds.x - languageBounds.width).toBeLessThanOrEqual(12);
  expect(
    Math.abs(
      languageBounds.y + languageBounds.height / 2 - profileBounds.y - profileBounds.height / 2
    )
  ).toBeLessThanOrEqual(3);
}

async function seedLogin(pool: Pool, preferredLocale: Locale | null) {
  const userId = randomUUID();
  const rawToken = randomUUID();
  await pool.query(
    `INSERT INTO "User" (id, email, name, role, "preferredLocale", "createdAt")
     VALUES ($1, $2, 'Localization Test Host', 'HOST'::"Role", $3, now())`,
    [userId, `e2e-localization-${userId}@test.internal`, preferredLocale]
  );
  try {
    await pool.query(
      `INSERT INTO "MagicToken" (id, "userId", token, "expiresAt", "createdAt", used, type)
       VALUES ($1, $2, $3, $4, now(), false, 'LOGIN'::"MagicTokenType")`,
      [
        randomUUID(),
        userId,
        createHash("sha256").update(rawToken).digest("hex"),
        new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ]
    );
  } catch (error) {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    throw error;
  }
  return { userId, rawToken };
}

async function savedLocale(pool: Pool, userId: string) {
  return (
    await pool.query<{ preferredLocale: string | null }>(
      `SELECT "preferredLocale" FROM "User" WHERE id = $1`,
      [userId]
    )
  ).rows[0].preferredLocale;
}

test.describe("Personal language selection", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shared language button appears beside the profile on public, auth, access and missing pages", async ({
    page,
  }) => {
    for (const path of [
      "/",
      "/auth/sign-in",
      "/auth/register",
      `/e/${PUBLIC_EVENT_SLUG}`,
      `/e/${PUBLIC_EVENT_SLUG}/rsvp?status=GOING`,
      `/e/${PRIVATE_EVENT_SLUG}`,
      `/e/${PASSWORD_EVENT_SLUG}`,
      "/localization-page-does-not-exist",
    ]) {
      await page.goto(path);
      await expectHeader(page);
    }
    await page.goto("/");
    await chooseLanguage(page, "nl-NL");
    const cookie = (await page.context().cookies()).find((item) => item.name === LOCALE_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.path).toBe("/");
    await page.reload();
    await expectHeader(page, "nl-NL");
    await page.goto("/auth/sign-in");
    await expect(page.locator("html")).toHaveAttribute("lang", "nl-NL");
    await expectHeader(page, "nl-NL");
    await page.screenshot({ path: "/tmp/rsvp-01a150ee-login-nl.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}`);
    await expectHeader(page, "nl-NL");
    await expect(page.getByRole("heading", { name: "E2E Test Event", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const bounds = (await header(page).getByRole("button", { name: choiceName }).boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "/tmp/rsvp-01a150ee-event-nl.png" });
  });

  test("German anonymous selection survives reload and fits a mobile header", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await chooseLanguage(page, "de-DE");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
    await expectHeader(page, "de-DE");
    await expect(page.getByRole("button", { name: german.Ui.Language.choose })).toBeVisible();
    const cookie = (await page.context().cookies()).find((item) => item.name === LOCALE_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.path).toBe("/");
    await page.screenshot({ path: "/tmp/rsvp-01a150ee-login-de.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}`);
    await expectHeader(page, "de-DE");
    await expect(page.getByRole("heading", { name: "E2E Test Event", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const bounds = (await header(page).getByRole("button", { name: choiceName }).boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "/tmp/rsvp-01a150ee-event-de.png" });
  });

  test("Spanish anonymous selection survives reload and fits a mobile header", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await chooseLanguage(page, "es-ES");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "es-ES");
    await expectHeader(page, "es-ES");
    await expect(page.getByRole("button", { name: spanish.Ui.Language.choose })).toBeVisible();
    const cookie = (await page.context().cookies()).find((item) => item.name === LOCALE_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.path).toBe("/");
    await page.screenshot({ path: "/tmp/rsvp-01a15d69-login-es.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}`);
    await expectHeader(page, "es-ES");
    await expect(page.getByRole("heading", { name: "E2E Test Event", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const bounds = (await header(page).getByRole("button", { name: choiceName }).boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "/tmp/rsvp-01a15d69-event-es.png" });
  });

  test("changing RSVP language preserves typed values, query and event-written title", async ({
    page,
  }) => {
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}/rsvp?status=GOING`);
    await page
      .getByPlaceholder(english.Ui.Rsvp.RsvpFlow.nameRequired)
      .fill("Untranslated draft guest");
    await page
      .getByPlaceholder(english.Ui.Rsvp.RsvpFlow.leaveNote)
      .fill("Keep this guest-written note exactly.");
    const originalUrl = page.url();
    await chooseLanguage(page, "nl-NL");
    await expect(page).toHaveURL(originalUrl);
    await expect(page.getByPlaceholder(dutch.Ui.Rsvp.RsvpFlow.nameRequired)).toHaveValue(
      "Untranslated draft guest"
    );
    await expect(page.getByPlaceholder(dutch.Ui.Rsvp.RsvpFlow.leaveNote)).toHaveValue(
      "Keep this guest-written note exactly."
    );
    await expect(page.getByRole("heading", { name: "E2E Test Event", exact: true })).toBeVisible();
  });

  test("changing RSVP language to Spanish preserves typed values, query and event-written title", async ({
    page,
  }) => {
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}/rsvp?status=GOING`);
    await page
      .getByPlaceholder(english.Ui.Rsvp.RsvpFlow.nameRequired)
      .fill("Untranslated draft guest");
    await page
      .getByPlaceholder(english.Ui.Rsvp.RsvpFlow.leaveNote)
      .fill("Keep this guest-written note exactly.");
    const originalUrl = page.url();
    await chooseLanguage(page, "es-ES");
    await expect(page).toHaveURL(originalUrl);
    await expect(page.getByPlaceholder(spanish.Ui.Rsvp.RsvpFlow.nameRequired)).toHaveValue(
      "Untranslated draft guest"
    );
    await expect(page.getByPlaceholder(spanish.Ui.Rsvp.RsvpFlow.leaveNote)).toHaveValue(
      "Keep this guest-written note exactly."
    );
    await expect(page.getByRole("heading", { name: "E2E Test Event", exact: true })).toBeVisible();
  });

  for (const scenario of [
    {
      label: "saved Spanish account beats Dutch browser",
      account: "es-ES",
      browser: "nl-NL",
      expected: "es-ES",
      saved: "es-ES",
    },
    {
      label: "unset account adopts Spanish only after verification",
      account: null,
      browser: "es-ES",
      expected: "es-ES",
      saved: "es-ES",
    },
    {
      label: "saved German account beats Dutch browser",
      account: "de-DE",
      browser: "nl-NL",
      expected: "de-DE",
      saved: "de-DE",
    },
    {
      label: "saved account beats Dutch browser",
      account: "en-US",
      browser: "nl-NL",
      expected: "en-US",
      saved: "en-US",
    },
    {
      label: "unset account adopts Dutch only after verification",
      account: null,
      browser: "nl-NL",
      expected: "nl-NL",
      saved: "nl-NL",
    },
    {
      label: "unset account and browser stay null with English UI",
      account: null,
      browser: null,
      expected: "en-US",
      saved: null,
    },
  ] as const) {
    test(scenario.label, async ({ page }) => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      let userId: string | undefined;
      try {
        const fixture = await seedLogin(pool, scenario.account);
        userId = fixture.userId;
        await page.goto("/auth/sign-in");
        if (scenario.browser) await chooseLanguage(page, scenario.browser);
        expect(await savedLocale(pool, userId)).toBe(scenario.account);
        await page.goto("/auth/verify?token=invalid-localization-test-token");
        await expect(page).toHaveURL(/error=invalid-token/);
        expect(await savedLocale(pool, userId)).toBe(scenario.account);
        await page.goto(`/auth/verify?token=${fixture.rawToken}`);
        await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);
        await expect(page.locator("html")).toHaveAttribute("lang", scenario.expected);
        await expectHeader(page, scenario.expected);
        expect(await savedLocale(pool, userId)).toBe(scenario.saved);
        const localeCookie = (await page.context().cookies()).find(
          (cookie) => cookie.name === LOCALE_COOKIE
        );
        if (scenario.browser || scenario.account)
          expect(localeCookie?.value).toBe(scenario.expected);
        else expect(localeCookie).toBeUndefined();
      } finally {
        try {
          if (userId) await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
        } finally {
          await pool.end();
        }
      }
    });
  }

  test("profile circle saves account and browser preference and survives a new browser context", async ({
    page,
    browser,
  }) => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    let userId: string | undefined;
    try {
      const fixture = await seedLogin(pool, "en-US");
      userId = fixture.userId;
      await page.goto(`/auth/verify?token=${fixture.rawToken}`);
      await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);
      await page.goto("/profile");
      const settingsButton = page
        .getByRole("button", { name: choiceName })
        .filter({ visible: true })
        .nth(1);
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();
      await page.getByRole("menuitemradio", { name: "Nederlands" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "nl-NL");
      await expect.poll(() => savedLocale(pool, fixture.userId)).toBe("nl-NL");
      await expect
        .poll(
          async () =>
            (await page.context().cookies()).find((cookie) => cookie.name === LOCALE_COOKIE)?.value
        )
        .toBe("nl-NL");
      const cookies = await page.context().cookies();
      expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("nl-NL");
      const fresh = await browser.newContext({
        baseURL: new URL(page.url()).origin,
        storageState: {
          cookies: cookies.filter((cookie) => cookie.name === SESSION_COOKIE),
          origins: [],
        },
      });
      try {
        const nextPage = await fresh.newPage();
        await nextPage.goto("/profile");
        await expect(nextPage.locator("html")).toHaveAttribute("lang", "nl-NL");
        await expectHeader(nextPage, "nl-NL");
      } finally {
        await fresh.close();
      }
    } finally {
      try {
        if (userId) await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
      } finally {
        await pool.end();
      }
    }
  });
});
