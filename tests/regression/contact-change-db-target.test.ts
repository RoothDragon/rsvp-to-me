// Root cause: destructive integration setup can run before per-test database
// guards. Validate the explicit disposable target before invoking schema setup.
import { afterEach, describe, expect, it, vi } from "vitest";
const { prepareSchema } = vi.hoisted(() => ({ prepareSchema: vi.fn() }));
vi.mock("@/tests/integration/global-setup", () => ({ setup: prepareSchema }));
import { setup } from "@/tests/integration/auth/contact-change-setup";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("contact-change disposable database guard", () => {
  it.each([
    ["postgresql://postgres:postgres@production.example:55432/rsvp_test", "01a18e04"],
    ["postgresql://postgres:postgres@127.0.0.1:5432/rsvp_test", "01a18e04"],
    ["postgresql://postgres:postgres@127.0.0.1:55432/development", "01a18e04"],
    ["postgresql://postgres:postgres@127.0.0.1:55432/rsvp_test", ""],
  ])("refuses schema setup for an unapproved target/marker", async (url, marker) => {
    vi.stubEnv("DATABASE_URL", url);
    vi.stubEnv("CONTACT_CHANGE_DISPOSABLE_DB", marker);
    await expect(setup()).rejects.toThrow("explicit disposable");
    expect(prepareSchema).not.toHaveBeenCalled();
  });
  it("allows schema setup only after the disposable target and marker match", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:55432/rsvp_test");
    vi.stubEnv("CONTACT_CHANGE_DISPOSABLE_DB", "01a18e04");
    await setup();
    expect(prepareSchema).toHaveBeenCalledTimes(1);
  });
});
