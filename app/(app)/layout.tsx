import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/auth/guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Guard>
      <AppShell>{children}</AppShell>
    </Guard>
  );
}
