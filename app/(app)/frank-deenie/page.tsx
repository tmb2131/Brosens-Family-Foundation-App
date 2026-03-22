import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getFrankDeenieSnapshot, listDonationNameSuggestions } from "@/lib/frank-deenie-data";
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

  const [snapshot, names] = await Promise.all([
    getFrankDeenieSnapshot(admin),
    listDonationNameSuggestions(admin)
  ]);

  return (
    <Suspense fallback={<FrankDeenieFallback />}>
      <FrankDeenieClient
        profile={profile}
        initialSnapshot={snapshot}
        initialNameSuggestions={names}
      />
    </Suspense>
  );
}
