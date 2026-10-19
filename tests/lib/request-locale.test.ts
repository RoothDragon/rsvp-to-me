import { describe, it, expect, vi, beforeEach } from "vitest";
const { getSessionUser, get } = vi.hoisted(() => ({ getSessionUser: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/session-user", () => ({ getSessionUser }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get }) }));
import { getRequestLocale } from "@/i18n/server";
describe("request locale precedence", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses account preference before conflicting cookie", async () => {
    getSessionUser.mockResolvedValue({ preferredLocale: "nl-NL" });
    get.mockReturnValue({ value: "en-US" });
    expect(await getRequestLocale()).toBe("nl-NL");
  });
  it("uses browser preference without account preference", async () => {
    getSessionUser.mockResolvedValue({ preferredLocale: null });
    get.mockReturnValue({ value: "nl-NL" });
    expect(await getRequestLocale()).toBe("nl-NL");
  });
  it("uses English for invalid cookie and no account", async () => {
    getSessionUser.mockResolvedValue(null);
    get.mockReturnValue({ value: "constructor" });
    expect(await getRequestLocale()).toBe("en-US");
  });
});
