import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/components/render";
const m = vi.hoisted(() => ({ session: vi.fn(), events: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: m.session }));
vi.mock("@/lib/db", () => ({ db: { event: { findMany: m.events } } }));
vi.mock("@/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/server")>();
  return {
    ...actual,
    getRequestLocale: async () => "en-US",
    getRequestTranslator: async () => actual.getTranslator("en-US"),
  };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
import Home from "@/app/page";
beforeEach(() => {
  vi.clearAllMocks();
  m.events.mockResolvedValue([]);
});
it("lets authenticated guests choose public events without redirecting back to dashboard", async () => {
  m.session.mockResolvedValue({ userId: "guest", role: "GUEST" });
  render(await Home());
  expect(screen.getByText("Choose a public event below to RSVP.")).toBeInTheDocument();
  expect(m.events).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ visibility: "PUBLIC" }) })
  );
});
it.each(["HOST", "ADMIN"])("keeps the %s dashboard redirect", async (role) => {
  m.session.mockResolvedValue({ userId: "organizer", role });
  await expect(Home()).rejects.toThrow("REDIRECT:/dashboard");
  expect(m.events).not.toHaveBeenCalled();
});
