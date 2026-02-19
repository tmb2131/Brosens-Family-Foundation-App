"use client";

import { useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { Check, CheckCircle2, ClipboardList, DollarSign, Eye, EyeOff, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/ui/metric-card";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { StatusPill } from "@/components/ui/status-pill";
import { charityNavigatorRating, currency, formatNumber, titleCase, voteChoiceLabel } from "@/lib/utils";
import { FoundationSnapshot } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MeetingProposal = FoundationSnapshot["proposals"][number];
type MeetingSegment = "ready" | "pending" | "needs_discussion";

function getMeetingSegment(proposal: MeetingProposal): MeetingSegment {
  const hasNoOrFlagged = proposal.voteBreakdown.some(
    (v) => v.choice === "no" || v.choice === "flagged"
  );
  if (hasNoOrFlagged) return "needs_discussion";
  if (!proposal.progress.isReadyForMeeting) return "pending";
  return "ready";
}

interface MeetingResponse {
  proposals: FoundationSnapshot["proposals"];
}

function MeetingProposalCard({
  proposal,
  userRole,
  saving,
  onOpenDecisionDialog
}: {
  proposal: MeetingProposal;
  userRole: string;
  saving: boolean;
  onOpenDecisionDialog: (proposalId: string) => void;
}) {
  const votesComplete =
    proposal.progress.totalRequiredVotes > 0 &&
    proposal.progress.votesSubmitted >= proposal.progress.totalRequiredVotes;

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border border-t-2 bg-background p-4 shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
        proposal.proposalType === "joint"
          ? "border-t-indigo-400 dark:border-t-indigo-500"
          : "border-t-amber-400 dark:border-t-amber-500"
      }`}
    >
      {/* Summary: title + status */}
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-base font-semibold">{proposal.title}</h3>
        <span className="shrink-0">
          <StatusPill status={proposal.status} />
        </span>
      </div>

      {/* Primary amount with context label */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Final amount
        </p>
        <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
          {currency(proposal.progress.computedFinalAmount)}
        </p>
      </div>
      {proposal.description?.trim() ? (
        <p className="text-sm text-muted-foreground">{proposal.description.trim()}</p>
      ) : null}

      {/* Metadata block */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Type
          </span>
          <p className="mt-0.5 font-medium text-foreground">{titleCase(proposal.proposalType)}</p>
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rule
          </span>
          <p className="mt-0.5 font-medium text-foreground">
            {proposal.proposalType === "joint"
              ? proposal.allocationMode === "sum"
                ? "Sum of allocations"
                : titleCase(proposal.allocationMode)
              : "Proposer-set"}
          </p>
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Votes in
          </span>
          <p className="mt-0.5 flex items-center gap-1.5 font-medium text-foreground">
            {votesComplete ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : null}
            {formatNumber(proposal.progress.votesSubmitted)} of{" "}
            {formatNumber(proposal.progress.totalRequiredVotes)}
          </p>
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Proposed
          </span>
          <p className="mt-0.5 font-medium text-foreground">{currency(proposal.proposedAmount)}</p>
        </div>
      </div>

      {proposal.voteBreakdown.some((v) => v.choice === "flagged" && v.flagComment) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Flag comments
          </p>
          <ul className="mt-1.5 list-none space-y-1 text-amber-900 dark:text-amber-100">
            {proposal.voteBreakdown
              .filter((v) => v.choice === "flagged" && v.flagComment)
              .map((vote) => (
                <li key={vote.userId}>
                  <span className="font-medium">{vote.userId}:</span> {vote.flagComment}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {userRole === "oversight" && proposal.charityNavigatorUrl ? (
        <div className="rounded-xl border border-border/70 bg-muted/60 p-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Charity Navigator
          </p>
          {proposal.charityNavigatorScore != null ? (
            <>
              <p className="mt-1.5 font-medium text-foreground">
                This charity&apos;s score is {Math.round(proposal.charityNavigatorScore)}%, earning it a{" "}
                {charityNavigatorRating(proposal.charityNavigatorScore).starLabel} rating.
              </p>
              <p className="mt-1 text-muted-foreground">
                {charityNavigatorRating(proposal.charityNavigatorScore).meaning}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-muted-foreground">Score not yet available.</p>
          )}
          <a
            href={proposal.charityNavigatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            View on Charity Navigator
          </a>
        </div>
      ) : null}

      {/* CTA separated from content */}
      <div className="border-t pt-3">
        <Button
          className="w-full"
          size="lg"
          disabled={saving}
          onClick={() => onOpenDecisionDialog(proposal.id)}
          aria-label={`Review and confirm: ${proposal.title}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Review & confirm
        </Button>
      </div>
    </article>
  );
}

export default function MeetingPage() {
  const { user } = useAuth();
  const { data, mutate, isLoading, error } = useSWR<MeetingResponse>("/api/meeting", {
    refreshInterval: 30_000
  });
  const [activeSegment, setActiveSegment] = useState<MeetingSegment>("pending");
  const [meetingDialogProposalId, setMeetingDialogProposalId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    proposalId: string;
    proposalTitle: string;
    status: "approved" | "declined";
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  if (!user || !["oversight", "manager"].includes(user.role)) {
    return (
      <GlassCard>
        <CardLabel>Meeting Sync Access</CardLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          This view is reserved for process oversight and foundation manager roles.
        </p>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <CardLabel>Meeting Sync Error</CardLabel>
        <p className="mt-2 text-sm text-rose-600">{error.message}</p>
        <Button
          variant="outline"
          size="lg"
          className="mt-3"
          onClick={() => void mutate()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </GlassCard>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="page-stack pb-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const updateMeeting = async (payload: Record<string, unknown>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await fetch("/api/meeting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      void mutate();
      void globalMutate("/api/navigation/summary");
      void globalMutate("/api/workspace");
      mutateAllFoundation();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const totalRecommendedAmount = data.proposals.reduce(
    (sum, proposal) => sum + proposal.progress.computedFinalAmount,
    0
  );
  const jointCount = data.proposals.filter((proposal) => proposal.proposalType === "joint").length;
  const discretionaryCount = data.proposals.length - jointCount;

  const readyProposals = data.proposals.filter((p) => getMeetingSegment(p) === "ready");
  const pendingProposals = data.proposals.filter((p) => getMeetingSegment(p) === "pending");
  const needsDiscussionProposals = data.proposals.filter(
    (p) => getMeetingSegment(p) === "needs_discussion"
  );

  const segmentProposals: Record<MeetingSegment, MeetingProposal[]> = {
    ready: readyProposals,
    pending: pendingProposals,
    needs_discussion: needsDiscussionProposals
  };

  const meetingDialogProposal =
    meetingDialogProposalId != null
      ? data.proposals.find((p) => p.id === meetingDialogProposalId)
      : null;

  const metricsCards = [
    <MetricCard
      key="pending"
      title="PENDING"
      value={formatNumber(data.proposals.length)}
      icon={ClipboardList}
      tone="sky"
    />,
    <MetricCard
      key="recommended"
      title="RECOMMENDED"
      value={currency(totalRecommendedAmount)}
      icon={DollarSign}
      tone="indigo"
    />
  ];

  return (
    <div className="page-stack pb-4">
      {/* Mobile: compact header row (same as before) */}
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Meeting</p>
        <button
          type="button"
          onClick={() => void mutate()}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors active:bg-muted hover:text-foreground focus:outline-none"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Desktop: page header card (consistent with My Workspace) */}
      <GlassCard className="hidden rounded-3xl lg:block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Meeting</CardLabel>
            <CardValue>Live Meeting</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
              Live meeting
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatNumber(data.proposals.length)} pending</span>
              <span className="hidden text-border sm:inline">|</span>
              <span>{currency(totalRecommendedAmount)} recommended</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void mutate()}
            disabled={saving}
            className="sm:min-h-11 sm:px-4 sm:text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </GlassCard>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-6">
          <GlassCard className="p-3 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                <ClipboardList className="h-4 w-4" />
              </span>
              <CardLabel>Meeting Stats</CardLabel>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{formatNumber(data.proposals.length)}</p>
                <p className="text-[10px] text-muted-foreground">{formatNumber(jointCount)} joint · {formatNumber(discretionaryCount)} disc.</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{currency(totalRecommendedAmount)}</p>
                <p className="text-[10px] text-muted-foreground">total across all proposals</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-3">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <Eye className="h-4 w-4" />
                </span>
                <CardLabel>Proposals</CardLabel>
              </div>
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                {data.proposals.length} total
              </span>
            </div>

            <Tabs value={activeSegment} onValueChange={(value) => setActiveSegment(value as MeetingSegment)}>
              <div className="flex justify-end">
                <TabsList className="h-auto flex-wrap gap-2">
                  <TabsTrigger value="ready">
                  Ready ({formatNumber(readyProposals.length)})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({formatNumber(pendingProposals.length)})
                </TabsTrigger>
                <TabsTrigger value="needs_discussion">
                  <span className="sm:hidden">Flagged</span>
                  <span className="hidden sm:inline">Needs discussion</span>
                  {" "}({formatNumber(needsDiscussionProposals.length)})
                </TabsTrigger>
              </TabsList>
              </div>
              {(["ready", "pending", "needs_discussion"] as const).map((segment) => (
                <TabsContent key={segment} value={segment} className="mt-3 space-y-3">
                  {segmentProposals[segment].length > 0 &&
                    segmentProposals[segment].map((proposal) => (
                      <MeetingProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        userRole={user.role}
                        saving={saving}
                        onOpenDecisionDialog={setMeetingDialogProposalId}
                      />
                    ))
                  }
                </TabsContent>
              ))}
            </Tabs>
          </GlassCard>
        </div>

        <div className="hidden lg:block">
          <div className="lg:sticky lg:top-6">
            <div className="grid gap-3">{metricsCards}</div>
          </div>
        </div>
      </div>

      <ResponsiveModal
        open={meetingDialogProposalId !== null}
        onOpenChange={(open) => { if (!open) setMeetingDialogProposalId(null); }}
      >
        {meetingDialogProposal ? (
          <ResponsiveModalContent
            aria-labelledby="meeting-decision-dialog-title"
            dialogClassName="max-w-md rounded-3xl p-5"
            showCloseButton={true}
          >
            <h2 id="meeting-decision-dialog-title" className="text-base font-semibold">
              {meetingDialogProposal.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {currency(meetingDialogProposal.progress.computedFinalAmount)} ·{" "}
              {formatNumber(meetingDialogProposal.progress.votesSubmitted)} of{" "}
              {formatNumber(meetingDialogProposal.progress.totalRequiredVotes)} votes in
            </p>
            {meetingDialogProposal.charityNavigatorUrl ? (
              <div className="mt-4 rounded-xl border border-border/70 bg-muted/60 p-3 text-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Charity Navigator
                </p>
                {meetingDialogProposal.charityNavigatorScore != null ? (
                  <>
                    <p className="mt-1.5 font-medium text-foreground">
                      This charity&apos;s score is {Math.round(meetingDialogProposal.charityNavigatorScore)}%, earning it a{" "}
                      {charityNavigatorRating(meetingDialogProposal.charityNavigatorScore).starLabel} rating.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {charityNavigatorRating(meetingDialogProposal.charityNavigatorScore).meaning}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-muted-foreground">Score not yet available.</p>
                )}
                <a
                  href={meetingDialogProposal.charityNavigatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  View on Charity Navigator
                </a>
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                disabled={saving}
                onClick={() => {
                  void updateMeeting({
                    action: "reveal",
                    proposalId: meetingDialogProposal.id,
                    reveal: true
                  });
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                Reveal Votes
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={saving}
                onClick={() => {
                  void updateMeeting({
                    action: "reveal",
                    proposalId: meetingDialogProposal.id,
                    reveal: false
                  });
                }}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Mask Again
              </Button>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-600/90"
                disabled={saving}
                onClick={() => {
                  setConfirmAction({
                    proposalId: meetingDialogProposal.id,
                    proposalTitle: meetingDialogProposal.title,
                    status: "approved"
                  });
                  setMeetingDialogProposalId(null);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm Approved
              </Button>
              <Button
                variant="destructive"
                size="lg"
                disabled={saving}
                onClick={() => {
                  setConfirmAction({
                    proposalId: meetingDialogProposal.id,
                    proposalTitle: meetingDialogProposal.title,
                    status: "declined"
                  });
                  setMeetingDialogProposalId(null);
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                Confirm Declined
              </Button>
            </div>
            {meetingDialogProposal.revealVotes ? (
              <div className="mt-4 rounded-xl border border-border/70 bg-muted/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Revealed votes
                </p>
                <div className="mt-1.5 space-y-1 text-xs sm:mt-2 sm:text-sm">
                  {meetingDialogProposal.voteBreakdown.map((vote) => (
                    <div key={`${meetingDialogProposal.id}-${vote.userId}`}>
                      <p>
                        {vote.userId}: {voteChoiceLabel(vote.choice)} ({currency(vote.allocationAmount)})
                        {vote.choice === "flagged" && vote.flagComment ? (
                          <span className="block mt-0.5 pl-0 text-muted-foreground">
                            — {vote.flagComment}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[11px] text-muted-foreground sm:text-xs">
                Votes remain masked until reveal.
              </p>
            )}
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>

      <ResponsiveModal
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
      >
        {confirmAction ? (
          <ResponsiveModalContent
            aria-labelledby="confirm-decision-title"
            dialogClassName="max-w-md rounded-3xl p-5"
            showCloseButton={false}
          >
            <h2
              id="confirm-decision-title"
              className="text-base font-semibold"
            >
              {confirmAction.status === "approved" ? "Approve" : "Decline"} Proposal?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will mark <span className="font-medium text-foreground">{confirmAction.proposalTitle}</span> as{" "}
              <span className="font-medium text-foreground">{confirmAction.status}</span>. This action cannot be undone.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                disabled={saving}
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
              {confirmAction.status === "approved" ? (
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-600/90"
                  disabled={saving}
                  onClick={() => {
                    void updateMeeting({ action: "decision", proposalId: confirmAction.proposalId, status: "approved" });
                    setConfirmAction(null);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Approve"}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={saving}
                  onClick={() => {
                    void updateMeeting({ action: "decision", proposalId: confirmAction.proposalId, status: "declined" });
                    setConfirmAction(null);
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Decline"}
                </Button>
              )}
            </div>
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>
    </div>
  );
}
