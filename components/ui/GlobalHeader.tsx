"use client";
import { usePathname } from "next/navigation";
import { AppTopNav } from "./AppNav";
import type { DropdownUser } from "./ProfileDropdown";
export default function GlobalHeader({ user }: { user: DropdownUser | null }) {
  const path = usePathname();
  const event = path.startsWith("/e/");
  return (
    <AppTopNav
      user={user}
      variant={
        event
          ? path.split("/").filter(Boolean).length === 2
            ? "event-overlay"
            : "fixed"
          : "default"
      }
    />
  );
}
