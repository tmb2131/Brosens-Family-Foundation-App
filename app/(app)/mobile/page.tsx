import { Suspense } from "react";
import MobileFocusClient from "@/app/(app)/mobile/mobile-client";
import { SkeletonCard } from "@/components/ui/skeleton";

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
