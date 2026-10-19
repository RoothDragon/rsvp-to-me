// @vitest-environment jsdom
// Root cause: extracting the sign-in footer prompt removed its trailing space,
// joining the localized prompt directly to the accented account-creation link.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../components/render";
import dutch from "@/messages/nl-NL.json";
import SignInForm from "@/app/auth/sign-in/SignInForm";
import RegisterForm from "@/app/auth/register/RegisterForm";

vi.mock("@/app/actions/auth", () => ({
  sendMagicLinkAction: vi.fn(),
  registerHostAction: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({
    runWithCaptcha: (_action: string, callback: (token: null) => unknown) => callback(null),
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("localized auth footer spacing", () => {
  const cases = [
    {
      locale: "en-US" as const,
      messages: undefined,
      openRegistration: true,
      expected: "No account? Create one →",
    },
    {
      locale: "en-US" as const,
      messages: undefined,
      openRegistration: false,
      expected: "New host? Create one →",
    },
    {
      locale: "nl-NL" as const,
      messages: dutch,
      openRegistration: true,
      expected: "Nog geen account? Account aanmaken →",
    },
    {
      locale: "nl-NL" as const,
      messages: dutch,
      openRegistration: false,
      expected: "Nieuwe organisator? Account aanmaken →",
    },
  ];
  it.each(cases)(
    "separates sign-in footer text in $locale, openRegistration=$openRegistration",
    ({ locale, messages, openRegistration, expected }) => {
      render(<SignInForm openRegistration={openRegistration} />, { locale, messages });
      const link = screen.getByRole("link", { name: expected });
      expect(link.getAttribute("href")).toBe("/auth/register");
      expect(link.textContent?.replace(/\s+/g, " ").trim()).toBe(expected);
    }
  );

  it.each(cases)(
    "retains registration footer spacing in $locale, openRegistration=$openRegistration",
    ({ locale, messages, openRegistration }) => {
      render(<RegisterForm openRegistration={openRegistration} />, { locale, messages });
      const expected =
        locale === "en-US"
          ? "Already have an account? Sign in →"
          : "Heb je al een account? Inloggen →";
      const link = screen.getByRole("link", { name: expected });
      expect(link.getAttribute("href")).toBe("/auth/sign-in");
      expect(link.textContent?.replace(/\s+/g, " ").trim()).toBe(expected);
    }
  );
});
