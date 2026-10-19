import { describe, it, expect } from "vitest";
import { useTranslations } from "next-intl";
import { render, screen } from "./render";
function Message({ keyName }: { keyName: "save" | "cancel" }) {
  const t = useTranslations("Ui.Common");
  return <p>{t(keyName)}</p>;
}
describe("real intl render helper", () => {
  it("keeps provider and caller wrapper through rerender", () => {
    const view = render(<Message keyName="save" />, {
      wrapper: ({ children }) => <section aria-label="Caller wrapper">{children}</section>,
    });
    expect(screen.getByText("Save")).toBeInTheDocument();
    view.rerender(<Message keyName="cancel" />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Caller wrapper" })).toBeInTheDocument();
  });
});
