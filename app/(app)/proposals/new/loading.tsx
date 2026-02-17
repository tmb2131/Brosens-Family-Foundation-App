import { SkeletonCard } from "@/components/ui/skeleton";

export default function NewProposalLoading() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
