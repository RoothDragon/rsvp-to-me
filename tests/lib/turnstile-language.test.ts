import { describe, it, expect } from "vitest";
import { getTurnstileLanguage } from "@/i18n/turnstile";
describe("Turnstile documented language capability", () => {
  it("normalizes chosen registered English and Dutch codes", () => {
    expect(getTurnstileLanguage("en-US")).toBe("en-us");
    expect(getTurnstileLanguage("nl-NL")).toBe("nl-nl");
  });
  it("uses supported base for a future regional contribution", () => {
    expect(getTurnstileLanguage("fr-CA")).toBe("fr");
  });
  it("safely defaults unsupported future application locales", () => {
    expect(getTurnstileLanguage("eo-001")).toBe("auto");
    expect(getTurnstileLanguage("x-private")).toBe("auto");
  });
});
