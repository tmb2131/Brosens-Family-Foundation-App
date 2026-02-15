import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonChart />
      <SkeletonCard />
    </div>
  );
}
