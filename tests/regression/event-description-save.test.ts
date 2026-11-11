// 01a18e04: rich descriptions must be sanitized on both server write paths,
// not only in the browser preview. Inline edits also lacked the creation length cap.
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  guard: vi.fn(),
  captcha: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { event: { create: mocks.create, update: mocks.update } } }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session, destroySession: vi.fn() }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: mocks.captcha }));
vi.mock("@/lib/slug", () => ({ generateUniqueSlug: vi.fn().mockResolvedValue("party") }));
vi.mock("@/app/actions/event/shared", () => ({
  assertHost: mocks.guard,
  assertHostOrCohost: mocks.guard,
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));
import { createEvent } from "@/app/actions/createEvent";
import { saveEventField } from "@/app/actions/event/settings";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.captcha.mockResolvedValue(undefined);
  mocks.session.mockResolvedValue({ userId: "host", role: "HOST" });
  mocks.user.mockResolvedValue({ id: "host" });
  mocks.guard.mockResolvedValue({ id: "event", slug: "party" });
  mocks.create.mockResolvedValue({ slug: "party" });
});

const unsafe =
  '<h2 onclick="alert(1)">Agenda</h2><script>bad()</script><img src="https://tracker.example/x">';
function form(description: string) {
  const f = new FormData();
  Object.entries({
    title: "Party",
    startDate: "2030-01-01",
    startTime: "18:00",
    description,
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}

describe("event description server writes", () => {
  it("sanitizes new event descriptions before persisting", async () => {
    await expect(createEvent(form(unsafe))).rejects.toThrow("redirect");
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: "<h2>Agenda</h2>" }),
    });
  });
  it("sanitizes inline edits before persisting", async () => {
    await saveEventField("event", "description", unsafe);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "event" },
      data: { description: "<h2>Agenda</h2>" },
    });
    expect(mocks.guard).toHaveBeenCalledWith("event");
  });
  it("rejects overlong descriptions in both write paths", async () => {
    await expect(createEvent(form("x".repeat(10001)))).rejects.toThrow();
    await expect(saveEventField("event", "description", "x".repeat(10001))).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires host authorization for inline edits", async () => {
    mocks.guard.mockRejectedValue(new Error("Unauthorized"));
    await expect(saveEventField("event", "description", unsafe)).rejects.toThrow("Unauthorized");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires a host session for creation and captcha on edits", async () => {
    mocks.session.mockResolvedValue({ role: "GUEST" });
    await expect(createEvent(form(unsafe))).rejects.toThrow("Unauthorized");
    mocks.captcha.mockRejectedValue(new Error("Captcha rejected"));
    await expect(saveEventField("event", "description", unsafe)).rejects.toThrow(
      "Captcha rejected"
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("clears empty descriptions", async () => {
    await saveEventField("event", "description", "");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "event" },
      data: { description: null },
    });
  });
});
