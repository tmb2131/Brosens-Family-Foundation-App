import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/auth/guard";
import { LastAccessedTouch } from "@/components/auth/LastAccessedTouch";
import { DashboardWalkthroughProvider } from "@/components/dashboard-walkthrough-context";
import { WorkspaceWalkthroughProvider } from "@/components/workspace-walkthrough-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceWalkthroughProvider>
      <DashboardWalkthroughProvider>
        <Guard>
          <LastAccessedTouch />
          <AppShell>{children}</AppShell>
        </Guard>
      </DashboardWalkthroughProvider>
    </WorkspaceWalkthroughProvider>
  );
}
