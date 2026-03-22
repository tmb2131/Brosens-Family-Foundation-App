import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getWorkspaceSnapshot, listProposalTitleSuggestions } from "@/lib/foundation-data";
import NewProposalClient from "./new-proposal-client";

function NewProposalFallback() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default async function NewProposalPage() {
  const { profile, admin } = await requirePageAuth();

  const [workspace, titles] = await Promise.all([
    getWorkspaceSnapshot(admin, profile),
    listProposalTitleSuggestions(admin)
  ]);

  return (
    <Suspense fallback={<NewProposalFallback />}>
      <NewProposalClient
        profile={profile}
        initialWorkspace={workspace}
        initialTitleSuggestions={titles}
      />
    </Suspense>
  );
}
