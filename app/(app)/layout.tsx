import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/auth/guard";
import { LastAccessedTouch } from "@/components/auth/LastAccessedTouch";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Guard>
      <LastAccessedTouch />
      <AppShell>{children}</AppShell>
    </Guard>
  );
}
