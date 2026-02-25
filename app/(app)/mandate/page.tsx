import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import MandateClient from "./mandate-client";

function MandateFallback() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default function MandatePage() {
  return (
    <Suspense fallback={<MandateFallback />}>
      <MandateClient />
    </Suspense>
  );
}
