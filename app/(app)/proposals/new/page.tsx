import { requirePageAuth } from "@/lib/auth-server";
import { getWorkspaceSnapshot, listProposalTitleSuggestions } from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
import NewProposalClient from "./new-proposal-client";

export default async function NewProposalPage() {
  const perf = startPagePerf("/proposals/new");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const [workspace, titles] = await Promise.all([
    getWorkspaceSnapshot(admin, profile),
    listProposalTitleSuggestions(admin)
  ]);
  perf.step("fetchProposalFormData");
  perf.done();

  return (
    <NewProposalClient
      profile={profile}
      initialWorkspace={workspace}
      initialTitleSuggestions={titles}
    />
  );
}
