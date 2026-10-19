import { vi } from "vitest";
vi.mock("@/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/server")>();
  return {
    ...actual,
    getRequestLocale: async () => "en-US" as const,
    getRequestTranslator: async () => actual.getTranslator("en-US"),
  };
});
