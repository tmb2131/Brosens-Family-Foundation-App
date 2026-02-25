import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import NewProposalClient from "./new-proposal-client";

function NewProposalFallback() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={<NewProposalFallback />}>
      <NewProposalClient />
    </Suspense>
  );
}
