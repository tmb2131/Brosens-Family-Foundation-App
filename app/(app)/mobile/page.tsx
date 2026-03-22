import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getWorkspaceSnapshot } from "@/lib/foundation-data";
import MobileFocusClient from "@/app/(app)/mobile/mobile-client";

export default async function MobilePage() {
  const { profile, admin } = await requirePageAuth();
  const workspace = await getWorkspaceSnapshot(admin, profile);

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
