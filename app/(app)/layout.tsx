import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/auth/guard";
import { LastAccessedTouch } from "@/components/auth/LastAccessedTouch";
import { ServerAuthSeed } from "@/components/auth/server-auth-seed";
import { ScrollToTop } from "@/components/scroll-to-top";
import { DashboardWalkthroughProvider } from "@/components/dashboard-walkthrough-context";
import { MobileWalkthroughProvider } from "@/components/mobile-walkthrough-context";
import { WorkspaceWalkthroughProvider } from "@/components/workspace-walkthrough-context";
import { requirePageAuth } from "@/lib/auth-server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = await requirePageAuth();

  return (
    <WorkspaceWalkthroughProvider>
      <DashboardWalkthroughProvider>
        <MobileWalkthroughProvider>
          <ServerAuthSeed profile={profile} />
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
