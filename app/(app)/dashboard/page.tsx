import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData,
  buildHistoryFromData,
  buildPendingProposalsFromData,
  buildWorkspaceSnapshotFromData
} from "@/lib/foundation-data";
import { FoundationSnapshot } from "@/lib/types";
import { startPagePerf } from "@/lib/perf-logger";
import DashboardClient from "@/app/(app)/dashboard/dashboard-client";

export default async function DashboardPage() {
  const perf = startPagePerf("/dashboard");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const isOversight = profile.role === "oversight";

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  perf.step("fetchFoundationPageData");

  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  const historyByYear = buildHistoryFromData(pageData);
  const pendingProposals = isOversight ? buildPendingProposalsFromData(pageData, profile.id) : null;
  const workspace = buildWorkspaceSnapshotFromData(pageData, profile, foundation);
  perf.step("buildSnapshots");
  perf.done();

  return (
    <DashboardClient
      profile={profile}
      initialFoundation={foundation}
      initialHistory={{ historyByYear }}
      initialWorkspace={workspace}
      initialPending={pendingProposals ? { proposals: pendingProposals as FoundationSnapshot["proposals"] } : null}
    />
  );
}
