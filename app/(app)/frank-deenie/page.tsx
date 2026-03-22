import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getFrankDeenieSnapshot } from "@/lib/frank-deenie-data";
import { startPagePerf } from "@/lib/perf-logger";
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
  const perf = startPagePerf("/frank-deenie");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const snapshot = await getFrankDeenieSnapshot(admin);
  perf.step("getFrankDeenieSnapshot");
  perf.done();

  return (
    <Suspense fallback={<FrankDeenieFallback />}>
      <FrankDeenieClient
        profile={profile}
        initialSnapshot={snapshot}
      />
    </Suspense>
  );
}
