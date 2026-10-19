import { describe, it, expect, vi, beforeEach } from "vitest";
const { updateMany, findUnique, cookieSet } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  cookieSet: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { user: { updateMany, findUnique } } }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: cookieSet })) }));
import { adoptLoginLocale, writeLocaleCookie } from "@/i18n/preferences";
describe("verified login language preference", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps account preference ahead of browser cookie", async () => {
    expect(await adoptLoginLocale({ id: "u", preferredLocale: "nl-NL" }, "en-US")).toBe("nl-NL");
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("leaves a new account null without valid browser choice", async () => {
    expect(await adoptLoginLocale({ id: "u", preferredLocale: null }, "unknown")).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("conditionally adopts cookie and rereads authoritative account after a race", async () => {
    findUnique.mockResolvedValue({ preferredLocale: "en-US" });
    expect(await adoptLoginLocale({ id: "u", preferredLocale: null }, "nl-NL")).toBe("en-US");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "u", preferredLocale: null },
      data: { preferredLocale: "nl-NL" },
    });
  });
  it("writes a durable HttpOnly preference cookie", async () => {
    await writeLocaleCookie("nl-NL");
    expect(cookieSet).toHaveBeenCalledWith(
      "rsvp-locale",
      "nl-NL",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 })
    );
  });
});
