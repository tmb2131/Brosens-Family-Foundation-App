import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth-server";
import { getProposalDetail } from "@/lib/foundation-data";
import { HttpError } from "@/lib/http-error";
import { startPagePerf } from "@/lib/perf-logger";
import { buildProposalShareMetadata } from "@/lib/proposal-share-metadata";
import ProposalDetailClient from "@/app/(app)/proposals/[proposalId]/proposal-detail-client";

/**
 * Names the browser tab, and supplies the preview card when the URL is shared
 * somewhere that reaches this page directly. The unauthenticated case redirects
 * to /login before rendering, so that page carries the same metadata for
 * link-unfurling bots.
 */
export async function generateMetadata({
  params
}: {
  params: Promise<{ proposalId: string }>;
}): Promise<Metadata> {
  const { proposalId } = await params;
  return (await buildProposalShareMetadata(proposalId)) ?? { title: "Proposal" };
}

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
