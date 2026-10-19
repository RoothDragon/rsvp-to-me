import { describe, it, expect, vi, beforeEach } from "vitest";
const { getSession, update, set } = vi.hoisted(() => ({
  getSession: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/db", () => ({ db: { user: { update } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
import { setPreferredLocale } from "@/app/actions/locale";
describe("language preference authorization", () => {
  beforeEach(() => vi.clearAllMocks());
  it("signed-out visitors only set their own browser cookie", async () => {
    getSession.mockResolvedValue(null);
    await setPreferredLocale("nl-NL");
    expect(update).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      "rsvp-locale",
      "nl-NL",
      expect.objectContaining({ httpOnly: true })
    );
  });
  it("updates only authenticated session account then sets cookie", async () => {
    getSession.mockResolvedValue({ userId: "authenticated" });
    await setPreferredLocale("nl-NL");
    expect(update).toHaveBeenCalledWith({
      where: { id: "authenticated" },
      data: { preferredLocale: "nl-NL" },
    });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
  });
  it("rejects unregistered locale before reading authority or writing", async () => {
    await expect(setPreferredLocale("__proto__")).rejects.toThrow("Unsupported locale");
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it("does not change cookie if account persistence fails", async () => {
    getSession.mockResolvedValue({ userId: "authenticated" });
    update.mockRejectedValueOnce(new Error("offline"));
    await expect(setPreferredLocale("nl-NL")).rejects.toThrow("offline");
    expect(set).not.toHaveBeenCalled();
  });
});
