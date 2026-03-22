import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getMandatePolicyPageData } from "@/lib/policy-data";
import { startPagePerf } from "@/lib/perf-logger";
import MandateClient from "./mandate-client";

function MandateFallback() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default async function MandatePage() {
  const perf = startPagePerf("/mandate");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const mandate = await getMandatePolicyPageData(admin, profile);
  perf.step("getMandatePolicyPageData");
  perf.done();

  return (
    <Suspense fallback={<MandateFallback />}>
      <MandateClient profile={profile} initialMandate={mandate} />
    </Suspense>
  );
}
