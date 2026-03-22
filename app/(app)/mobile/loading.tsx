import { SkeletonCard } from "@/components/ui/skeleton";

export default function MobileLoading() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
