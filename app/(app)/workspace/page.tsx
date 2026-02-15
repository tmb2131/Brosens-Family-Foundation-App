import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import WorkspaceClient from "@/app/(app)/workspace/workspace-client";

export default function WorkspacePage() {
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
      <WorkspaceClient />
    </Suspense>
  );
}
