
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/tests/components/render";
import { useState } from "react";
import { DisplayOptionsPanel } from "@/components/event/settings-page/DisplayOptionsPanel";
import { testTheme } from "./helpers/theme";

const saveSettings = vi.fn();

function TestPanel({
  initialVisibility = "UNLISTED",
  initialVerified = false,
  passwordHash = null,
}: {
  initialVisibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  initialVerified?: boolean;
  passwordHash?: string | null;
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [requireVerifiedRsvp, setRequireVerifiedRsvp] = useState(initialVerified);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [guestSharingEnabled, setGuestSharingEnabled] = useState(true);
  const [guestListVis, setGuestListVis] = useState<"ALL" | "GUESTS_ONLY" | "HOST_ONLY">("ALL");
  const [guestsCanInvite, setGuestsCanInvite] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [, setPasswordSavedAsNull] = useState(false);

  return (
    <DisplayOptionsPanel
      commentsEnabled={commentsEnabled}
      setCommentsEnabled={setCommentsEnabled}
      guestSharingEnabled={guestSharingEnabled}
      setGuestSharingEnabled={setGuestSharingEnabled}
      guestListVis={guestListVis}
      setGuestListVis={setGuestListVis}
      guestRsvpDisplay={{}}
      onGuestRsvpDisplayChange={vi.fn()}
      visibility={visibility}
      setVisibility={setVisibility}
      requireVerifiedRsvp={requireVerifiedRsvp}
      setRequireVerifiedRsvp={setRequireVerifiedRsvp}
      guestsCanInvite={guestsCanInvite}
      setGuestsCanInvite={setGuestsCanInvite}
      password={password}
      setPassword={setPassword}
      passwordDirty={passwordDirty}
      setPasswordDirty={setPasswordDirty}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      setPasswordSavedAsNull={setPasswordSavedAsNull}
      effectivePasswordHash={passwordHash}
      triggerSaveSettings={saveSettings}
      t={testTheme}
      S={{ inp: {} } as React.ComponentProps<typeof DisplayOptionsPanel>["S"]}
    />
  );
}

beforeEach(() => {
  saveSettings.mockClear();
});

describe("DisplayOptionsPanel verified RSVP compatibility", () => {
  it("disables verification for PRIVATE events", () => {
    render(<TestPanel initialVisibility="PRIVATE" />);

    const toggle = screen.getByRole("button", {
      name: "Require verified RSVP contact",
    });

    expect(toggle).toBeDisabled();
    expect(
      screen.getByText(
        "Verified RSVP is currently available only for public and unlisted events."
      )
    ).toBeInTheDocument();

    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("allows verification for UNLISTED events", () => {
    render(<TestPanel initialVisibility="UNLISTED" />);

    const toggle = screen.getByRole("button", {
      name: "Require verified RSVP contact",
    });

    expect(toggle).toBeEnabled();

    fireEvent.click(toggle);

    expect(saveSettings).toHaveBeenCalledWith({
      requireVerifiedRsvp: true,
    });
  });

  it("requires disabling verification before switching to PRIVATE", () => {
    render(<TestPanel initialVisibility="UNLISTED" initialVerified />);

    const privateOption = screen.getByRole("radio", {
      name: "Private — invite only",
    });

    expect(privateOption).toBeDisabled();
    expect(
      screen.getByText("Disable verified RSVP before switching to a private event.")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Require verified RSVP contact",
      })
    );

    expect(saveSettings).toHaveBeenCalledWith({
      requireVerifiedRsvp: false,
    });

    expect(privateOption).toBeEnabled();

    fireEvent.click(privateOption);

    expect(saveSettings).toHaveBeenCalledWith({
      visibility: "PRIVATE",
    });
  });
});
