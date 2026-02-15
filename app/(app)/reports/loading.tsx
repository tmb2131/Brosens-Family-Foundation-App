import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="page-stack pb-6">
      <SkeletonCard />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonChart />
    </div>
  );
}
