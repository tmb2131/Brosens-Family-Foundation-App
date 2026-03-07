"use client";

import { AlertTriangle, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, formatNumber, titleCase } from "@/lib/utils";
import { FoundationSnapshot } from "@/lib/types";

type MeetingProposal = FoundationSnapshot["proposals"][number];

interface MeetingProposalCardProps {
  proposal: MeetingProposal;
  userRole: string;
  saving: boolean;
  onOpenDecisionDialog: (proposalId: string) => void;
}

export function MeetingProposalCard({
  proposal,
  userRole,
  saving,
  onOpenDecisionDialog
}: MeetingProposalCardProps) {
  const votesComplete =
    proposal.progress.totalRequiredVotes > 0 &&
    proposal.progress.votesSubmitted >= proposal.progress.totalRequiredVotes;
  const flagCount = proposal.voteBreakdown.filter(
    (v) => v.choice === "flagged" && v.flagComment
  ).length;
  const cnScore =
    userRole === "oversight" && proposal.charityNavigatorScore != null
      ? Math.round(proposal.charityNavigatorScore)
      : null;

  return (
    <article
      className={`content-auto group relative flex flex-col gap-2 rounded-xl border border-t-2 bg-background p-4 shadow-sm transition-all hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
        proposal.proposalType === "joint"
          ? "border-t-indigo-400 dark:border-t-indigo-500 hover:border-t-indigo-500"
          : "border-t-amber-400 dark:border-t-amber-500 hover:border-t-amber-500"
      }`}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold leading-tight">{proposal.title}</h3>
        <span className="shrink-0">
          <StatusPill status={proposal.status} />
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="shrink-0">
          <p className="text-lg font-bold tabular-nums text-foreground">
            {currency(proposal.progress.computedFinalAmount)}
          </p>
          <p className="text-[10px] text-muted-foreground">final amount</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 font-medium">
            {titleCase(proposal.proposalType)}
          </span>
          <span className="inline-flex items-center gap-1">
            {votesComplete ? (
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : null}
            <span className="font-medium">{formatNumber(proposal.progress.votesSubmitted)}/{formatNumber(proposal.progress.totalRequiredVotes)}</span>
            <span className="text-muted-foreground">votes</span>
          </span>
          {flagCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              <span className="font-medium">{flagCount}</span>
              <span className="text-muted-foreground">flagged</span>
            </span>
          ) : null}
          {cnScore != null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100/80 px-2 py-1 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              <span className="font-medium">CN {cnScore}%</span>
            </span>
          ) : null}
        </div>
      </div>

      <div>
        <Button
          className="w-full sm:w-auto sm:flex-1 transition-colors group-hover:bg-primary/90"
          size="sm"
          disabled={saving}
          onClick={() => onOpenDecisionDialog(proposal.id)}
          aria-label={`Review and confirm: ${proposal.title}`}
        >
          <Eye className="h-3.5 w-3.5 mr-2" />
          Review & confirm
        </Button>
      </div>
    </article>
  );
}
