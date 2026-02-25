import { Suspense } from "react";
import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";
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

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsClient />
    </Suspense>
  );
}
