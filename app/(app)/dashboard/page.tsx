import { Suspense } from "react";
import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";
import DashboardClient from "@/app/(app)/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
