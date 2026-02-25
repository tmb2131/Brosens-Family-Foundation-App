import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import FrankDeenieClient from "./frank-deenie-client";

function FrankDeenieFallback() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default function FrankDeeniePage() {
  return (
    <Suspense fallback={<FrankDeenieFallback />}>
      <FrankDeenieClient />
    </Suspense>
  );
}
