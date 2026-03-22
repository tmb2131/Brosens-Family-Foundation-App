import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData,
  buildWorkspaceSnapshotFromData
} from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
import WorkspaceClient from "@/app/(app)/workspace/workspace-client";

export default async function WorkspacePage() {
  const perf = startPagePerf("/workspace");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  if (profile.role === "manager") {
    redirect("/dashboard");
  }

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  perf.step("fetchFoundationPageData");

  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  const workspace = buildWorkspaceSnapshotFromData(pageData, profile, foundation);
  perf.step("buildSnapshots");
  perf.done();

  return <WorkspaceClient initialWorkspace={workspace} />;
}
