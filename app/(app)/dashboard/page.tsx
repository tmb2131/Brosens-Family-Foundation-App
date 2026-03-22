import { Suspense } from "react";
import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData,
  buildHistoryFromData,
  buildPendingProposalsFromData,
  buildWorkspaceSnapshotFromData
} from "@/lib/foundation-data";
import { FoundationSnapshot } from "@/lib/types";
import DashboardClient from "@/app/(app)/dashboard/dashboard-client";

export default async function DashboardPage() {
  const { profile, admin } = await requirePageAuth();
  const isOversight = profile.role === "oversight";

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  const historyByYear = buildHistoryFromData(pageData);
  const pendingProposals = isOversight ? buildPendingProposalsFromData(pageData, profile.id) : null;
  const workspace = buildWorkspaceSnapshotFromData(pageData, profile, foundation);

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      }
    >
      <DashboardClient
        profile={profile}
        initialFoundation={foundation}
        initialHistory={{ historyByYear }}
        initialWorkspace={workspace}
        initialPending={pendingProposals ? { proposals: pendingProposals as FoundationSnapshot["proposals"] } : null}
      />
    </Suspense>
  );
}
