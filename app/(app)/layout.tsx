import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/auth/guard";
import { LastAccessedTouch } from "@/components/auth/LastAccessedTouch";
import { ScrollToTop } from "@/components/scroll-to-top";
import { DashboardWalkthroughProvider } from "@/components/dashboard-walkthrough-context";
import { MobileWalkthroughProvider } from "@/components/mobile-walkthrough-context";
import { WorkspaceWalkthroughProvider } from "@/components/workspace-walkthrough-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceWalkthroughProvider>
      <DashboardWalkthroughProvider>
        <MobileWalkthroughProvider>
          <Guard>
            <ScrollToTop />
            <LastAccessedTouch />
            <AppShell>{children}</AppShell>
          </Guard>
        </MobileWalkthroughProvider>
      </DashboardWalkthroughProvider>
    </WorkspaceWalkthroughProvider>
  );
}
