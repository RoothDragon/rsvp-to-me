import { test, expect } from "@playwright/test";
import {
  CREATED_EVENT_SLUG,
  CREATED_EVENT_TITLE,
  PUBLIC_EVENT_SLUG,
  readAuthCookies,
} from "./fixtures";

test.describe("Host event management", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies(readAuthCookies());
  });

  test("authenticated host sees host controls on their event page", async ({ page }) => {
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}`);
    await expect(page.getByText("E2E Test Event")).toBeVisible();
    // Host bar or settings link should be visible for the host
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard shows the host's events", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole("link", { name: "E2E Test Event" }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("host can open event settings", async ({ page }) => {
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}/settings`);
    await expect(page.getByRole("heading", { name: "Event Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Display Options/ })).toBeVisible();
  });

  test("host can create, edit, and collapse a formatted description", async ({ page }) => {
    await page.goto("/dashboard/events/new");
    await page.getByPlaceholder("Wine Night at Jane's").fill(CREATED_EVENT_TITLE);
    const description = `<h2>Event plan</h2><p>${"Welcome to the event. ".repeat(90)}</p><ul><li>Bring snacks</li></ul><hr><img src="/should-not-load-description-image" onerror="alert(1)">`;
    const editor = page.getByRole("textbox", { name: "Description", exact: true });
    await expect(editor).toHaveCSS("resize", "both");
    await editor.fill(description);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Event plan" })).toBeVisible();
    await expect(page.locator('section[aria-label="Preview"] img')).toHaveCount(0);
    // Leave preview open to prove the hidden textarea still participates in FormData.
    await page.locator('input[name="startDate"]').fill("2031-06-15");
    await page.locator('input[name="startTime"]').fill("19:30");
    await page.getByRole("button", { name: /TBD/ }).click();
    await page.getByLabel("Public").check();
    await page.getByRole("button", { name: /Create Event/ }).click();

    await page.waitForURL(`**/e/${CREATED_EVENT_SLUG}`);
    await expect(page.getByRole("heading", { name: CREATED_EVENT_TITLE })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show more", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(page.getByRole("heading", { name: "Event plan" })).toBeVisible();
    await page.getByRole("button", { name: "Show more", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Event plan" })).toBeVisible();
    await expect(page.getByText("Bring snacks", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit description", exact: true }).click();
    const inlineEditor = page.getByRole("textbox", { name: "Description", exact: true });
    await expect(inlineEditor).toHaveCSS("resize", "both");
    await inlineEditor.fill(description + "<p>Updated details</p>");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Updated details", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Event plan" })).toBeVisible();
    await page.getByRole("button", { name: "Show more", exact: true }).click();
    await expect(page.getByText("Updated details", { exact: true })).toBeVisible();
    // Native link navigation must open the original upload, including from the keyboard.
    const coverInput = page
      .getByRole("button", { name: "📷 Cover", exact: true })
      .locator("..")
      .locator("..")
      .locator('input[type="file"]');
    await coverInput.setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGNICdhCU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAMumoEzyJvizAAAAAElFTkSuQmCC",
        "base64"
      ),
    });
    const coverLink = page.getByRole("link", {
      name: `Open full cover image for ${CREATED_EVENT_TITLE} (opens in a new tab)`,
    });
    await expect(coverLink).toHaveAttribute("href", /^\/api\/uploads\//);
    await expect(coverLink).toHaveAttribute("rel", "noopener noreferrer");
    await coverLink.focus();
    const popupPromise = page.waitForEvent("popup");
    await coverLink.press("Enter");
    const popup = await popupPromise;
    await popup.waitForLoadState();
    expect(popup.url()).toBe(new URL((await coverLink.getAttribute("href"))!, page.url()).href);
    await popup.close();
    const guestContext = await page.context().browser()!.newContext();
    try {
      const guest = await guestContext.newPage();
      await guest.goto(page.url());
      await expect(guest.getByRole("button", { name: "Edit description" })).toHaveCount(0);
      await guest.getByRole("button", { name: "Show more", exact: true }).click();
      await expect(guest.getByRole("heading", { name: "Event plan" })).toBeVisible();
      await expect(guest.locator('[aria-labelledby="event-description-heading"] img')).toHaveCount(
        0
      );
      await guest.getByRole("button", { name: "Show less", exact: true }).click();
      await expect(guest.getByRole("heading", { name: "Event plan" })).toBeVisible();
      await expect(guest.getByText("Bring snacks", { exact: true })).toHaveCount(0);
    } finally {
      await guestContext.close();
    }
  });
});
