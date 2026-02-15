import { SkeletonCard } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
