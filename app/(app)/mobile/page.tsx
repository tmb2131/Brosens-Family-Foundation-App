import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import MobileFocusClient from "@/app/(app)/mobile/mobile-client";

export default function MobilePage() {
  return (
    <Suspense
      fallback={
        <div className="page-stack pb-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <MobileFocusClient />
    </Suspense>
  );
}
