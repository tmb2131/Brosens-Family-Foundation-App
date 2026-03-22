import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getMandatePolicyPageData } from "@/lib/policy-data";
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
  const { profile, admin } = await requirePageAuth();
  const mandate = await getMandatePolicyPageData(admin, profile);

  return (
    <Suspense fallback={<MandateFallback />}>
      <MandateClient profile={profile} initialMandate={mandate} />
    </Suspense>
  );
}
