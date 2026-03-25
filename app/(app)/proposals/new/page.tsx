import { requirePageAuth } from "@/lib/auth-server";
import { getProposalPrefill, getWorkspaceSnapshot, listProposalTitleSuggestions } from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
import NewProposalClient from "./new-proposal-client";

interface NewProposalPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function NewProposalPage({ searchParams }: NewProposalPageProps) {
  const perf = startPagePerf("/proposals/new");

  const [{ profile, admin }, resolvedParams] = await Promise.all([
    requirePageAuth(),
    searchParams,
  ]);
  perf.step("auth");

  const fromId = typeof resolvedParams.from === "string" ? resolvedParams.from.trim() : null;

  const [workspace, titles, prefill] = await Promise.all([
    getWorkspaceSnapshot(admin, profile),
    listProposalTitleSuggestions(admin),
    fromId ? getProposalPrefill(admin, fromId) : null,
  ]);
  perf.step("fetchProposalFormData");
  perf.done();

  return (
    <NewProposalClient
      profile={profile}
      initialWorkspace={workspace}
      initialTitleSuggestions={titles}
      prefill={prefill ?? undefined}
    />
  );
}
