import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { E2E_HOST_EMAIL, readAuthCookies } from "./fixtures";

for (const baseTheme of ["DARK", "SOFT"] as const) {
  test(`#749 ${baseTheme} named invitation review and guest rename preserve RSVP identity`, async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const eventId = randomUUID();
    const slug = `e2e-named-invitations-${eventId}`;
    const email = `issue749-${eventId}@test.internal`;
    try {
      const host = await pool.query<{ id: string }>('SELECT id FROM "User" WHERE email=$1', [
        E2E_HOST_EMAIL,
      ]);
      await pool.query(
        `INSERT INTO "Event" (id,slug,title,status,visibility,"startAt",timezone,"locationType","hostId","createdAt","updatedAt") VALUES ($1,$2,'Named Invitations Test','PUBLISHED','PRIVATE','2030-12-01T20:00:00Z','UTC','PHYSICAL',$3,now(),now())`,
        [eventId, slug, host.rows[0].id]
      );
      await pool.query(
        `INSERT INTO "EventTheme" (id,"eventId","baseTheme") VALUES ($1,$2,$3::"BaseTheme")`,
        [randomUUID(), eventId, baseTheme]
      );
      await context.addCookies(readAuthCookies());
      await page.goto(`/e/${slug}`);
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.getByLabel("Invitation draft").fill(`Alice Smith <${email}>`);
      await page.getByRole("button", { name: "Review invitations", exact: true }).click();
      await expect(page.getByLabel(`${email} — New`)).toBeChecked();
      await page.screenshot({
        path: testInfo.outputPath("invitation-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("invitation-mobile.png"), fullPage: true });
      await page.getByRole("button", { name: "Send 1 invitation", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: email })).toContainText("Sent");
      const rows = await pool.query<{ id: string; editToken: string; guestName: string }>(
        `SELECT id,"editToken","guestName" FROM "RSVP" WHERE "eventId"=$1 AND "guestEmail"=$2`,
        [eventId, email]
      );
      expect(rows.rows).toHaveLength(1);
      const invited = rows.rows[0];
      expect(invited.guestName).toBe("Alice Smith");
      const guest = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
      try {
        const guestPage = await guest.newPage();
        await guestPage.goto(`/e/${slug}/rsvp?token=${invited.editToken}`);
        const name = guestPage.getByPlaceholder("Your name (required)");
        await expect(name).toHaveValue("Alice Smith");
        await name.fill("Alice Jones");
        await guestPage.getByRole("button", { name: "Update RSVP", exact: true }).click();
        await expect(guestPage.getByText("RSVP updated!", { exact: true })).toBeVisible();
        const updated = await pool.query<{
          id: string;
          editToken: string;
          guestName: string;
          responded: boolean;
        }>(`SELECT id,"editToken","guestName",responded FROM "RSVP" WHERE "eventId"=$1`, [eventId]);
        expect(updated.rows).toEqual([
          {
            id: invited.id,
            editToken: invited.editToken,
            guestName: "Alice Jones",
            responded: true,
          },
        ]);
      } finally {
        await guest.close();
      }
      await page.goto(`/e/${slug}/guests`);
      await expect(page.getByText("Alice Jones", { exact: true }).first()).toBeVisible();
    } finally {
      await pool.query('DELETE FROM "Event" WHERE id=$1', [eventId]);
      await pool.query('DELETE FROM "User" WHERE email=$1', [email]);
      await pool.end();
    }
  });
}
