import { Suspense } from "react";
import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData
} from "@/lib/foundation-data";
import ReportsClient from "./reports-client";

function ReportsFallback() {
  return (
    <div className="page-stack pb-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonCard />
    </div>
  );
}

export default async function ReportsPage() {
  const { profile, admin } = await requirePageAuth();
  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);

  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsClient initialFoundation={foundation} />
    </Suspense>
  );
}
