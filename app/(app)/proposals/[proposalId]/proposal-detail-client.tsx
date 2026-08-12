"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Check, Link2, RefreshCw, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, GlassCard, CardLabel } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { PageWithSidebar } from "@/components/ui/page-with-sidebar";
import { RevalidatingDot } from "@/components/ui/revalidating-dot";
import { useCharityNavigatorPreview } from "@/lib/hooks/use-charity-navigator-preview";
import { usePagePerf } from "@/lib/perf-logger-client";
import { PRELOADED_SWR_CONFIG } from "@/lib/swr-helpers";
import type { ProposalDetailSnapshot, VoteBlockedReason } from "@/lib/types";
import {
  charityNavigatorRating,
  cn,
  currency,
  formatNumber,
  titleCase,
  voteChoiceLabel
} from "@/lib/utils";

const VoteForm = dynamic(
  () => import("@/components/voting/vote-form").then((m) => m.VoteForm),
  { ssr: false }
);

interface ProposalDetailClientProps {
  proposalId: string;
  initialDetail: ProposalDetailSnapshot;
}

/** Message shown in place of the vote form when the viewer cannot vote. */
const VOTE_BLOCKED_COPY: Record<VoteBlockedReason, { title: string; body: string }> = {
  not_voting_role: {
    title: "View only",
    body: "Your role does not cast votes on proposals. You can still review the full details here."
  },
  not_open_for_voting: {
    title: "Voting closed",
    body: "This proposal is no longer in review, so votes can’t be changed."
  },
  own_discretionary_proposal: {
    title: "Your proposal",
    body: "You submitted this discretionary proposal, so you don’t vote on it. Other members acknowledge or flag it."
  },
  already_voted: {
    title: "Vote submitted",
    body: "Your vote is recorded. Reach out to Oversight if you need it changed."
  }
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function DetailRow({
  label,
  children,
  className
}: React.PropsWithChildren<{ label: string; className?: string }>) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-foreground">{children}</dd>
    </div>
  );
}

export default function ProposalDetailClient({
  proposalId,
  initialDetail
}: ProposalDetailClientProps) {
  const [copied, setCopied] = useState(false);

  const detailQuery = useSWR<ProposalDetailSnapshot>(`/api/proposals/${proposalId}`, {
    refreshInterval: 30_000,
    fallbackData: initialDetail,
    ...PRELOADED_SWR_CONFIG
  });

  const detail = detailQuery.data ?? initialDetail;
  const { proposal, viewer, personalBudget } = detail;
  const charityNavigatorPreview = useCharityNavigatorPreview(proposal.charityNavigatorUrl);
  const previewOrganizationName = charityNavigatorPreview?.organizationName?.trim() || null;

  usePagePerf("/proposals/[proposalId]", !detailQuery.isLoading, {
    isLoading: detailQuery.isLoading,
    hasData: detailQuery.data !== undefined,
    error: detailQuery.error?.message ?? null
  });

  const handleShare = useCallback(async () => {
    const url = window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: proposal.title, url });
        return;
      } catch (error) {
        // User dismissed the share sheet, or it is unavailable — fall back to copying.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied", { description: "Share it to open this proposal directly." });
    } catch {
      toast.error("Could not copy the link", { description: url });
    }
  }, [proposal.title]);

  if (!detailQuery.data && detailQuery.error) {
    return (
      <GlassCard className="p-4" role="alert">
        <p className="text-sm text-rose-600">
          Failed to load this proposal: {detailQuery.error.message}
        </p>
        <Button variant="outline" size="lg" className="mt-3" onClick={() => void detailQuery.mutate()}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </GlassCard>
    );
  }

  if (!detailQuery.data) {
    return (
      <div className="page-stack pb-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const isOpenForVoting = proposal.status === "to_review";
  // A joint proposal's running total is other members' votes — keep it blind
  // until the viewer has voted or Oversight has revealed.
  const canSeeRunningTotal = !proposal.progress.masked;

  const votePanel = viewer.canVote ? (
    <Card className="gap-4 p-4">
      <CardLabel>Your vote</CardLabel>
      <VoteForm
        proposalId={proposal.id}
        proposalType={proposal.proposalType}
        proposedAmount={proposal.proposedAmount}
        totalRequiredVotes={proposal.progress.totalRequiredVotes}
        userId={viewer.userId}
        proposalTitle={proposal.title}
        onSuccess={() => {
          toast.success("Vote submitted");
          void detailQuery.mutate();
        }}
        maxJointAllocation={
          proposal.proposalType === "joint" && personalBudget
            ? personalBudget.jointRemaining + personalBudget.discretionaryRemaining
            : undefined
        }
        className="border-t-0 pt-0"
      />
    </Card>
  ) : (
    <Card className="gap-3 p-4">
      <CardLabel>Your vote</CardLabel>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {VOTE_BLOCKED_COPY[viewer.voteBlockedReason ?? "not_voting_role"].title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {VOTE_BLOCKED_COPY[viewer.voteBlockedReason ?? "not_voting_role"].body}
        </p>
      </div>
      {viewer.existingVote ? (
        <div className="rounded-xl border border-border bg-muted/60 p-3">
          <p className="text-sm font-semibold text-foreground">
            {voteChoiceLabel(viewer.existingVote.choice)}
            {proposal.proposalType === "joint" && viewer.existingVote.choice === "yes"
              ? ` · ${currency(viewer.existingVote.allocationAmount)}`
              : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {formatDate(viewer.existingVote.at)}
          </p>
          {viewer.existingVote.flagComment ? (
            <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">
              “{viewer.existingVote.flagComment}”
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );

  return (
    <div className="page-stack pb-4">
      <PageWithSidebar sticky collapsible={false} sidebar={votePanel}>
        <div className="space-y-3">
          <GlassCard className="rounded-3xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href="/workspace"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to My Workspace
                </Link>
                <h1 className="mt-2 flex items-center gap-2 text-xl font-bold leading-tight">
                  {proposal.title}
                  <RevalidatingDot
                    isValidating={detailQuery.isValidating}
                    hasData={detailQuery.data !== undefined}
                  />
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      proposal.proposalType === "joint"
                        ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
                        : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
                    )}
                  >
                    {titleCase(proposal.proposalType)}
                  </Badge>
                  <StatusPill status={proposal.status} />
                  <span className="text-xs text-muted-foreground">
                    Proposed by {proposal.proposerDisplayName} · {proposal.budgetYear}
                  </span>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => void handleShare()}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden /> Copied
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5 sm:hidden" aria-hidden />
                    <Link2 className="hidden h-3.5 w-3.5 sm:block" aria-hidden /> Share link
                  </>
                )}
              </Button>
            </div>
          </GlassCard>

          <Card className="gap-4 p-4">
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <DetailRow label={isOpenForVoting ? "Requested amount" : "Final amount"}>
                <span className="text-lg font-bold">
                  {isOpenForVoting
                    ? currency(proposal.proposedAmount)
                    : currency(proposal.progress.computedFinalAmount)}
                </span>
              </DetailRow>
              <DetailRow label="Votes in">
                <span className="font-semibold">
                  {formatNumber(proposal.progress.votesSubmitted)} of{" "}
                  {formatNumber(proposal.progress.totalRequiredVotes)}
                </span>
                {isOpenForVoting && proposal.proposalType === "joint" ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {canSeeRunningTotal
                      ? `${currency(proposal.progress.computedFinalAmount)} allocated so far`
                      : "Allocations hidden until you vote"}
                  </span>
                ) : null}
              </DetailRow>
              <DetailRow label="Description" className="md:col-span-2">
                <span className="whitespace-pre-wrap font-semibold">
                  {proposal.description?.trim() || "—"}
                </span>
              </DetailRow>
              <DetailRow label="Organization">
                <span className="font-semibold">{proposal.organizationName}</span>
              </DetailRow>
              <DetailRow label="Date sent">
                <span className="font-semibold">{formatDate(proposal.sentAt)}</span>
              </DetailRow>
              <DetailRow label="Organization website" className="md:col-span-2">
                {proposal.organizationWebsite ? (
                  <a
                    href={proposal.organizationWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                  >
                    {proposal.organizationWebsite}
                  </a>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Charity Navigator" className="md:col-span-2">
                {proposal.charityNavigatorUrl ? (
                  <>
                    <a
                      href={proposal.charityNavigatorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                    >
                      {proposal.charityNavigatorUrl}
                    </a>
                    {proposal.charityNavigatorScore != null ? (
                      <div className="mt-2 rounded-lg border border-border/70 bg-muted/50 p-2.5 text-xs">
                        <p className="font-medium text-foreground">
                          {previewOrganizationName
                            ? `${previewOrganizationName}'s score is `
                            : "This charity's score is "}
                          {Math.round(proposal.charityNavigatorScore)}%, earning it a{" "}
                          {charityNavigatorRating(proposal.charityNavigatorScore).starLabel} rating.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {charityNavigatorRating(proposal.charityNavigatorScore).meaning}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">Score not yet available.</p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">No Charity Navigator profile linked.</span>
                )}
              </DetailRow>
              {proposal.notes?.trim() ? (
                <DetailRow label="Notes" className="md:col-span-2">
                  <span className="whitespace-pre-wrap font-semibold">{proposal.notes.trim()}</span>
                </DetailRow>
              ) : null}
            </dl>
          </Card>

          {proposal.voteBreakdown.length > 0 ? (
            <Card className="gap-3 p-4">
              <CardLabel>Revealed votes ({proposal.voteBreakdown.length})</CardLabel>
              <ul className="divide-y divide-border">
                {proposal.voteBreakdown.map((vote) => (
                  <li key={vote.userId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{vote.userDisplayName}</p>
                      {vote.flagComment ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                          “{vote.flagComment}”
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {voteChoiceLabel(vote.choice)}
                      {proposal.proposalType === "joint" && vote.choice === "yes"
                        ? ` · ${currency(vote.allocationAmount)}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </PageWithSidebar>
    </div>
  );
}
