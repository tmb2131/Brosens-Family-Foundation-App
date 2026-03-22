import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData,
  buildWorkspaceSnapshotFromData
} from "@/lib/foundation-data";
import MobileFocusClient from "@/app/(app)/mobile/mobile-client";

export default async function MobilePage() {
  const { profile, admin } = await requirePageAuth();
  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  const workspace = buildWorkspaceSnapshotFromData(pageData, profile, foundation);

  return (
    <Suspense
      fallback={
        <div className="page-stack pb-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <MobileFocusClient initialWorkspace={workspace} />
    </Suspense>
  );
}
