import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getFrankDeenieSnapshot } from "@/lib/frank-deenie-data";
import FrankDeenieClient from "./frank-deenie-client";

function FrankDeenieFallback() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default async function FrankDeeniePage() {
  const { profile, admin } = await requirePageAuth();

  const snapshot = await getFrankDeenieSnapshot(admin);

  return (
    <Suspense fallback={<FrankDeenieFallback />}>
      <FrankDeenieClient
        profile={profile}
        initialSnapshot={snapshot}
      />
    </Suspense>
  );
}
