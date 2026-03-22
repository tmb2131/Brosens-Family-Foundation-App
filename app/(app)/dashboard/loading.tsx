import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      {/* Mobile: 3-col budget cards + chart + proposal card list */}
      <div className="grid grid-cols-3 gap-2 lg:hidden">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonChart className="lg:hidden" />
      <div className="space-y-0 lg:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-border/60 py-3.5 pl-3.5">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Desktop: metric cards + chart + table */}
      <div className="hidden gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonChart className="hidden lg:block" />
      <SkeletonCard className="hidden lg:block" />
    </div>
  );
}
