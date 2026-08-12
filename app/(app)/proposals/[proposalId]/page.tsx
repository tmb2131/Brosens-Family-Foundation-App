import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth-server";
import { getProposalDetail } from "@/lib/foundation-data";
import { HttpError } from "@/lib/http-error";
import { startPagePerf } from "@/lib/perf-logger";
import ProposalDetailClient from "@/app/(app)/proposals/[proposalId]/proposal-detail-client";

/**
 * The proposal title is intentionally not used in metadata: the page is behind
 * auth, so link unfurlers never see it, and a generic title keeps proposal
 * names out of browser history and shared screenshots of the tab bar.
 */
export const metadata: Metadata = {
  title: "Proposal"
};

export default async function ProposalDetailPage({
  params
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const perf = startPagePerf("/proposals/[proposalId]");

  const { proposalId } = await params;
  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  try {
    const detail = await getProposalDetail(admin, proposalId, profile);
    perf.step("getProposalDetail");
    perf.done();

    return <ProposalDetailClient proposalId={proposalId} initialDetail={detail} />;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
