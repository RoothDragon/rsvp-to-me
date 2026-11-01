// Root cause: separately consuming contact-change tokens allowed replay and lost
// retries on write failure. These tests use real Prisma/PostgreSQL transactions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/hash";
import { GET } from "@/app/auth/verify-change/route";

// Keep persistence and the route real. Only external/session-cookie effects are mocked.
vi.mock("@/lib/session", () => ({
  sealSession: vi.fn().mockResolvedValue("sealed"),
  COOKIE_NAME: "rsvp-session",
  SESSION_TTL: 3600,
}));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false, redisSet: vi.fn() }));
vi.mock("@/lib/auth", () => ({ linkRsvpsToUser: vi.fn() }));

const gate = vi.hoisted(() => ({
  enabled: false,
  arrivals: 0,
  wait: Promise.resolve(),
  release: () => {},
}));
// Hold both real SELECT results before allowing either route to claim the token.
vi.mock("@/lib/db", async (importOriginal) => {
  const { db: realDb } = await importOriginal<typeof import("@/lib/db")>();
  return {
    db: realDb.$extends({
      query: {
        magicToken: {
          async findUnique({ args, query }) {
            const record = await query(args);
            if (gate.enabled) {
              if (++gate.arrivals === 2) gate.release();
              await gate.wait;
            }
            return record;
          },
        },
      },
    }),
  };
});

let userId: string;
let eventId: string;
let rsvpId: string;
let rawToken: string;
let tokenId: string;
let oldEmail: string;
let newEmail: string;
const constraint = "contact_change_01a18e04_failure";
let constraintTable: "User" | "RSVP" | undefined;
function request(token = rawToken) {
  return new NextRequest(
    "http://localhost:3000/auth/verify-change?token=" + encodeURIComponent(token)
  );
}

beforeEach(async () => {
  userId = "";
  eventId = "";
  // Full preflight and GitHub CI discover this file. Refuse ordinary dev/remote DBs.
  const target = new URL(process.env.DATABASE_URL ?? "");
  const preflightTarget = target.hostname === "127.0.0.1" && target.port === "55432";
  const githubServiceTarget =
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.CI === "true" &&
    target.hostname === "localhost" &&
    target.port === "5432";
  if (target.pathname !== "/rsvp_test" || (!preflightTarget && !githubServiceTarget)) {
    throw new Error(
      "Requires disposable preflight PostgreSQL on 127.0.0.1:55432/rsvp_test or the GitHub Actions test service."
    );
  }
  const tag = randomUUID();
  oldEmail = tag + "@old.example";
  newEmail = tag + "@new.example";
  userId = (await db.user.create({ data: { email: oldEmail } })).id;
  eventId = (
    await db.event.create({
      data: {
        title: "Contact change test",
        slug: tag,
        hostId: userId,
        startAt: new Date("2035-01-01"),
      },
    })
  ).id;
  rsvpId = (
    await db.rSVP.create({
      data: { eventId, userId, guestName: "Guest", guestEmail: oldEmail, status: "GOING" },
    })
  ).id;
  rawToken = randomUUID();
  tokenId = (
    await db.magicToken.create({
      data: {
        userId,
        token: hashToken(rawToken),
        type: "EMAIL_CHANGE",
        metadata: newEmail,
        expiresAt: new Date(Date.now() + 60000),
      },
    })
  ).id;
});

afterEach(async () => {
  gate.enabled = false;
  gate.release();
  vi.restoreAllMocks();
  if (constraintTable) {
    await db.$executeRawUnsafe(
      'ALTER TABLE "' + constraintTable + '" DROP CONSTRAINT IF EXISTS "' + constraint + '"'
    );
    constraintTable = undefined;
  }
  // Delete only this test's fixtures; never truncate a shared database.
  if (eventId) await db.event.deleteMany({ where: { id: eventId } });
  if (userId) await db.user.deleteMany({ where: { id: userId } });
});

async function unchanged() {
  expect(await db.magicToken.findUnique({ where: { id: tokenId } })).toMatchObject({ used: false });
  expect(await db.user.findUnique({ where: { id: userId } })).toMatchObject({ email: oldEmail });
  expect(await db.rSVP.findUnique({ where: { id: rsvpId } })).toMatchObject({
    guestEmail: oldEmail,
  });
  expect(await db.session.count({ where: { userId } })).toBe(0);
}

describe("contact-change PostgreSQL atomicity", () => {
  it.each(["User", "RSVP"] as const)(
    "rolls back token and earlier writes after a %s constraint failure",
    async (table) => {
      constraintTable = table;
      // Identifiers/values below are generated fixture ids and UUID-based emails only.
      // A real PostgreSQL constraint forces failure after the token claim has executed.
      const column = table === "User" ? "email" : "guestEmail";
      const id = table === "User" ? userId : rsvpId;
      await db.$executeRawUnsafe(
        'ALTER TABLE "' +
          table +
          '" ADD CONSTRAINT "' +
          constraint +
          '" CHECK ("id" <> \'' +
          id +
          "' OR \"" +
          column +
          "\" <> '" +
          newEmail +
          "')"
      );
      await expect(GET(request())).rejects.toThrow();
      await unchanged();
      await db.$executeRawUnsafe(
        'ALTER TABLE "' + table + '" DROP CONSTRAINT "' + constraint + '"'
      );
      constraintTable = undefined;
      expect((await GET(request())).headers.get("location")).toContain("verified=1");
      expect(await db.magicToken.findUnique({ where: { id: tokenId } })).toMatchObject({
        used: true,
      });
    }
  );

  it("allows exactly one concurrent redemption after both requests read an unused token", async () => {
    gate.enabled = true;
    gate.arrivals = 0;
    gate.wait = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    const responses = await Promise.all([GET(request()), GET(request())]);
    gate.enabled = false;
    expect(responses.map((res) => new URL(res.headers.get("location")!).search).sort()).toEqual([
      "?error=invalid-token",
      "?verified=1",
    ]);
    expect(await db.session.count({ where: { userId } })).toBe(1);
    expect(await db.magicToken.findUnique({ where: { id: tokenId } })).toMatchObject({
      used: true,
    });
    expect(await db.user.findUnique({ where: { id: userId } })).toMatchObject({ email: newEmail });
    expect(await db.rSVP.findUnique({ where: { id: rsvpId } })).toMatchObject({
      guestEmail: newEmail,
    });
  });

  it.each(["missing", "expired", "wrong-type", "used"])(
    "rejects %s tokens without changing account or RSVP details",
    async (kind) => {
      if (kind === "expired")
        await db.magicToken.update({ where: { id: tokenId }, data: { expiresAt: new Date(0) } });
      if (kind === "wrong-type")
        await db.magicToken.update({ where: { id: tokenId }, data: { type: "LOGIN" } });
      if (kind === "used")
        await db.magicToken.update({ where: { id: tokenId }, data: { used: true } });
      const res = await GET(request(kind === "missing" ? "unknown" : rawToken));
      expect(res.headers.get("location")).toContain("error=invalid-token");
      if (kind !== "used") await unchanged();
      else {
        expect(await db.user.findUnique({ where: { id: userId } })).toMatchObject({
          email: oldEmail,
        });
        expect(await db.rSVP.findUnique({ where: { id: rsvpId } })).toMatchObject({
          guestEmail: oldEmail,
        });
        expect(await db.session.count({ where: { userId } })).toBe(0);
      }
    }
  );
});
