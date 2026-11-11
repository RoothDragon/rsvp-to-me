import { test, expect } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PUBLIC_EVENT_SLUG } from "./fixtures";

for (const destination of ["/", `/e/${PUBLIC_EVENT_SLUG}/rsvp?status=MAYBE`]) {
  test(`new guest email can verify and continue to ${destination}`, async ({ page }) => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const email = `guest-signin-${randomUUID()}@example.invalid`;
    try {
      const query = destination === "/" ? "" : `?redirect=${encodeURIComponent(destination)}`;
      await page.goto(`/auth/sign-in${query}`);
      await page.getByRole("textbox").fill(email);
      await page.getByRole("button", { name: "Send sign-in link", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Check your email", exact: true })
      ).toBeVisible();
      await expect(
        page.getByText("Check your email for a secure link to continue.", { exact: true })
      ).toBeVisible();
      const account = await pool.query('SELECT id,role FROM "User" WHERE email=$1', [email]);
      expect(account.rowCount).toBe(1);
      expect(account.rows[0].role).toBe("GUEST");
      const id = account.rows[0].id;
      expect((await pool.query('SELECT id FROM "Session" WHERE "userId"=$1', [id])).rowCount).toBe(
        0
      );
      const tokens = await pool.query(
        'SELECT id,metadata FROM "MagicToken" WHERE "userId"=$1 AND used=false',
        [id]
      );
      expect(tokens.rowCount).toBe(1);
      expect(JSON.parse(tokens.rows[0].metadata)).toEqual({
        verifiedMethod: "EMAIL",
        verifiedIdentifier: email,
      });
      // Isolated E2E has no real mail transport. Supply known entropy to the
      // generated token row, then exercise the actual one-time verification route.
      const raw = randomUUID();
      const hash = createHash("sha256").update(raw).digest("hex");
      await pool.query('UPDATE "MagicToken" SET token=$1 WHERE id=$2', [hash, tokens.rows[0].id]);
      await page.goto(
        `/auth/verify?token=${raw}${destination === "/" ? "" : `&redirect=${encodeURIComponent(destination)}`}`
      );
      await expect(page).toHaveURL(
        new URL(destination, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").href
      );
      if (destination === "/")
        await expect(page.getByText("Choose a public event below to RSVP.")).toBeVisible();
      else await expect(page.getByPlaceholder("Your name (required)")).toBeVisible();
      expect((await pool.query('SELECT id FROM "Session" WHERE "userId"=$1', [id])).rowCount).toBe(
        1
      );
      expect((await pool.query('SELECT role FROM "User" WHERE id=$1', [id])).rows[0].role).toBe(
        "GUEST"
      );
      expect(
        (await pool.query('SELECT used FROM "MagicToken" WHERE id=$1', [tokens.rows[0].id])).rows[0]
          .used
      ).toBe(true);
    } finally {
      await pool.query('DELETE FROM "User" WHERE email=$1', [email]);
      await pool.end();
    }
  });
}
