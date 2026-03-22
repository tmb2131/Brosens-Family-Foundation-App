import { SkeletonCard } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
