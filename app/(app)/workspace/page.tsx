import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData,
  buildWorkspaceSnapshotFromData
} from "@/lib/foundation-data";
import WorkspaceClient from "@/app/(app)/workspace/workspace-client";

export default async function WorkspacePage() {
  const { profile, admin } = await requirePageAuth();

  if (profile.role === "manager") {
    redirect("/dashboard");
  }

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  const workspace = buildWorkspaceSnapshotFromData(pageData, profile, foundation);

  return (
    <Suspense
      fallback={
        <div className="page-stack pb-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <WorkspaceClient initialWorkspace={workspace} />
    </Suspense>
  );
}
