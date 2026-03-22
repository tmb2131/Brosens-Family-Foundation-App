import { SkeletonCard } from "@/components/ui/skeleton";

export default function FrankDeenieLoading() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard />
    </div>
  );
}
