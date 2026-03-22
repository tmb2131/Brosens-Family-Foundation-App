import { Suspense } from "react";
import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData
} from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
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
  const perf = startPagePerf("/reports");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  perf.step("fetchFoundationPageData");

  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  perf.step("buildSnapshot");
  perf.done();

  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsClient initialFoundation={foundation} />
    </Suspense>
  );
}
