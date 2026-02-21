"use client";

import { useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { AlertTriangle, Check, CheckCircle2, ClipboardList, DollarSign, Eye, EyeOff, RefreshCw, XCircle } from "lucide-react";
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
  const flagCount = proposal.voteBreakdown.filter(
    (v) => v.choice === "flagged" && v.flagComment
  ).length;
  const cnScore =
    userRole === "oversight" && proposal.charityNavigatorScore != null
      ? Math.round(proposal.charityNavigatorScore)
      : null;

  return (
    <article
      className={`group relative flex flex-col gap-2 rounded-xl border border-t-2 bg-background p-4 shadow-sm transition-all hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
        proposal.proposalType === "joint"
          ? "border-t-indigo-400 dark:border-t-indigo-500 hover:border-t-indigo-500"
          : "border-t-amber-400 dark:border-t-amber-500 hover:border-t-amber-500"
      }`}
    >
      {/* Header with title and status */}
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold leading-tight">{proposal.title}</h3>
        <span className="shrink-0">
          <StatusPill status={proposal.status} />
        </span>
      </div>

      {/* Key metrics row */}
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

      {/* Action button */}
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

export default function MeetingPage() {
  const { user } = useAuth();
  const { data, mutate, isLoading, error } = useSWR<MeetingResponse>("/api/meeting", {
    refreshInterval: 30_000
  });
  const [activeSegment, setActiveSegment] = useState<MeetingSegment>("ready");
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
      <GlassCard className="rounded-3xl">
        <div className="text-center py-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardLabel>Meeting Sync Error</CardLabel>
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400 max-w-md mx-auto">
            {error.message}
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => void mutate()}
              disabled={saving}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} /> 
              {saving ? "Retrying..." : "Try Again"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
        </div>
      </GlassCard>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="page-stack pb-4">
        {/* Header skeleton */}
        <GlassCard className="rounded-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <div className="h-5 w-20 bg-muted rounded animate-pulse" />
              <div className="mt-1 h-7 w-32 bg-muted rounded animate-pulse" />
              <div className="mt-2 h-4 w-64 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-11 w-24 bg-muted rounded-lg animate-pulse" />
          </div>
        </GlassCard>

        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
          <div className="space-y-6">
            {/* Mobile stats skeleton */}
            <GlassCard className="p-3 lg:hidden">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 bg-muted rounded-lg animate-pulse" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="h-12 bg-muted rounded-xl animate-pulse" />
                <div className="h-12 bg-muted rounded-xl animate-pulse" />
              </div>
            </GlassCard>

            {/* Proposals section skeleton */}
            <GlassCard className="p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
                  <div>
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="mt-1 h-3 w-40 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-12 bg-muted rounded-full animate-pulse" />
              </div>

              {/* Tabs skeleton */}
              <div className="h-10 bg-muted/50 rounded-lg p-1 mb-3">
                <div className="flex gap-1">
                  <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
                  <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
                  <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
                </div>
              </div>

              {/* Proposal card skeletons */}
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-t-2 border-t-muted bg-background p-4">
                    <div className="flex justify-between gap-3 mb-3">
                      <div className="h-5 flex-1 bg-muted rounded animate-pulse" />
                      <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                    </div>
                    <div className="flex justify-between gap-3 mb-3">
                      <div className="flex gap-2">
                        <div className="h-6 w-12 bg-muted rounded-full animate-pulse" />
                        <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                      </div>
                      <div className="text-right">
                        <div className="h-6 w-20 bg-muted rounded animate-pulse ml-auto" />
                        <div className="h-3 w-16 bg-muted rounded animate-pulse ml-auto mt-1" />
                      </div>
                    </div>
                    <div className="h-9 w-full bg-muted rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Desktop metrics skeleton */}
          <div className="hidden lg:block">
            <div className="lg:sticky lg:top-6">
              <div className="grid gap-3">
                <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
                <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
              </div>
            </div>
          </div>
        </div>
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
    <div className="page-stack gap-3 lg:gap-6 pb-4">
      {/* Mobile: stats card with integrated live indicator */}
      <GlassCard className="p-4 lg:hidden">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <CardLabel>Meeting Stats</CardLabel>
              <p className="text-xs text-muted-foreground mt-0.5">Overview of all proposals</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/80 bg-gradient-to-r from-muted/30 to-muted/10 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="mt-2 text-lg font-bold tabular-nums text-foreground">{formatNumber(data.proposals.length)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{formatNumber(jointCount)} joint · {formatNumber(discretionaryCount)} disc.</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-gradient-to-r from-muted/30 to-muted/10 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended</p>
            <p className="mt-2 text-lg font-bold tabular-nums text-foreground">{currency(totalRecommendedAmount)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">total across all proposals</p>
          </div>
        </div>
      </GlassCard>

      {/* Desktop: page header card (consistent with My Workspace) */}
      <GlassCard className="hidden rounded-3xl lg:block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Meeting</CardLabel>
            <CardValue>Voting & Decisions</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Vote on pending proposals and finalize grant recommendations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-6">
          <GlassCard className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <Eye className="h-4 w-4" />
                </span>
                <div>
                  <CardLabel>Proposals</CardLabel>
                  <p className="text-xs text-muted-foreground mt-0.5">Review and decide on grant proposals</p>
                </div>
              </div>
              <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {data.proposals.length} total
              </span>
            </div>

            <Tabs value={activeSegment} onValueChange={(value) => setActiveSegment(value as MeetingSegment)}>
              <TabsList className="h-auto w-full grid grid-cols-3 gap-1 bg-muted/50 p-1" role="tablist">
                <TabsTrigger 
                  value="ready" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
                  role="tab"
                  aria-label={`Ready proposals (${formatNumber(readyProposals.length)} proposals)`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ready</span>
                  <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold" aria-label={`${formatNumber(readyProposals.length)} ready proposals`}>
                    {formatNumber(readyProposals.length)}
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="pending" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
                  role="tab"
                  aria-label={`Pending proposals (${formatNumber(pendingProposals.length)} proposals)`}
                >
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Pending</span>
                  <span className="sm:hidden">Wait</span>
                  <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-bold" aria-label={`${formatNumber(pendingProposals.length)} pending proposals`}>
                    {formatNumber(pendingProposals.length)}
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="needs_discussion" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
                  role="tab"
                  aria-label={`Proposals needing discussion (${formatNumber(needsDiscussionProposals.length)} proposals)`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sm:hidden">Issues</span>
                  <span className="hidden sm:inline">Needs discussion</span>
                  <span className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 text-[10px] font-bold" aria-label={`${formatNumber(needsDiscussionProposals.length)} flagged proposals`}>
                    {formatNumber(needsDiscussionProposals.length)}
                  </span>
                </TabsTrigger>
              </TabsList>
              {(["ready", "pending", "needs_discussion"] as const).map((segment) => (
                <TabsContent key={segment} value={segment} className="mt-4 space-y-2" role="tabpanel">
                  {segmentProposals[segment].length > 0 ? (
                    <div className="space-y-3">
                      {segmentProposals[segment].map((proposal) => (
                        <MeetingProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          userRole={user.role}
                          saving={saving}
                          onOpenDecisionDialog={setMeetingDialogProposalId}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-3">
                        {segment === "ready" && <CheckCircle2 className="h-6 w-6 text-muted-foreground" />}
                        {segment === "pending" && <ClipboardList className="h-6 w-6 text-muted-foreground" />}
                        {segment === "needs_discussion" && <AlertTriangle className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {segment === "ready" && "No proposals are ready for review"}
                        {segment === "pending" && "No pending proposals"}
                        {segment === "needs_discussion" && "No proposals need discussion"}
                      </p>
                    </div>
                  )}
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
            dialogClassName="max-w-lg rounded-3xl max-h-[90vh] flex flex-col"
            showCloseButton={true}
          >
            <div className="flex flex-col min-h-0">
              {/* Header */}
              <div className="mb-4">
                <h2 id="meeting-decision-dialog-title" className="text-lg font-semibold leading-tight">
                  {meetingDialogProposal.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {titleCase(meetingDialogProposal.proposalType)}
                  </span>
                  <StatusPill status={meetingDialogProposal.status} />
                </div>
              </div>

              {/* Amount display */}
              <div className="mb-4 rounded-xl border border-border/70 bg-gradient-to-r from-muted/50 to-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold tabular-nums text-foreground">
                      {currency(meetingDialogProposal.progress.computedFinalAmount)}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">
                      Final amount
                    </p>
                    {meetingDialogProposal.proposalType === "joint" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Proposed: {currency(meetingDialogProposal.proposedAmount)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(meetingDialogProposal.progress.votesSubmitted)} /{" "}
                      {formatNumber(meetingDialogProposal.progress.totalRequiredVotes)} votes
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {meetingDialogProposal.description?.trim() ? (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {meetingDialogProposal.description.trim()}
                  </p>
                </div>
              ) : null}

              {/* Charity Navigator */}
              {meetingDialogProposal.charityNavigatorUrl ? (
                <div className="mb-4 rounded-xl border border-border/70 bg-gradient-to-r from-sky-50/50 to-sky-50/30 dark:from-sky-900/20 dark:to-sky-900/10 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 flex items-center justify-center">
                      <DollarSign className="h-3 w-3" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Charity Navigator
                    </p>
                  </div>
                  {meetingDialogProposal.charityNavigatorScore != null ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {Math.round(meetingDialogProposal.charityNavigatorScore)}% · {charityNavigatorRating(meetingDialogProposal.charityNavigatorScore).starLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {charityNavigatorRating(meetingDialogProposal.charityNavigatorScore).meaning}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Score not yet available.</p>
                  )}
                  <a
                    href={meetingDialogProposal.charityNavigatorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                  >
                    View on Charity Navigator
                    <span className="text-xs">↗</span>
                  </a>
                </div>
              ) : null}

              {/* Action buttons */}
              <div className="mb-4 space-y-3">
                {/* Vote reveal controls */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      void updateMeeting({
                        action: "reveal",
                        proposalId: meetingDialogProposal.id,
                        reveal: true
                      });
                    }}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Reveal Votes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      void updateMeeting({
                        action: "reveal",
                        proposalId: meetingDialogProposal.id,
                        reveal: false
                      });
                    }}
                    className="flex-1"
                  >
                    <EyeOff className="h-3 w-3 mr-1" />
                    Mask Again
                  </Button>
                </div>

                {/* Decision controls */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
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
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
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
                    <XCircle className="h-3 w-3 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>

              {/* Vote breakdown - scrollable section */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {meetingDialogProposal.revealVotes ? (
                  <div className="rounded-xl border border-border/70 bg-muted/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 sticky top-0 bg-muted/50 pb-2">
                      Revealed votes ({meetingDialogProposal.voteBreakdown.length})
                    </p>
                    <div className="space-y-2 text-xs">
                      {meetingDialogProposal.voteBreakdown.map((vote) => (
                        <div key={`${meetingDialogProposal.id}-${vote.userId}`} className="flex items-start justify-between gap-2 pb-2 border-b border-border/20 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">
                                  {vote.userId}
                                </p>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                  vote.choice === 'yes' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                  vote.choice === 'no' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}>
                                  {voteChoiceLabel(vote.choice)}
                                </span>
                              </div>
                              <p className="font-bold text-foreground tabular-nums shrink-0">
                                {currency(vote.allocationAmount)}
                              </p>
                            </div>
                            {vote.choice === "flagged" && vote.flagComment ? (
                              <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">
                                &ldquo;{vote.flagComment}&rdquo;
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/30 bg-muted/30 p-3 text-center">
                    <EyeOff className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Votes remain masked until reveal for privacy.
                    </p>
                  </div>
                )}
              </div>
            </div>
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
            dialogClassName="max-w-md rounded-3xl p-6"
            showCloseButton={false}
          >
            {/* Warning icon and title */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                confirmAction.status === "approved" 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
              }`}>
                {confirmAction.status === "approved" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2
                  id="confirm-decision-title"
                  className="text-lg font-semibold"
                >
                  {confirmAction.status === "approved" ? "Approve" : "Decline"} Proposal?
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This action cannot be undone
                </p>
              </div>
            </div>

            {/* Proposal details */}
            <div className="mb-6 p-4 rounded-xl border border-border/70 bg-muted/30">
              <p className="text-sm font-medium text-foreground mb-1">
                {confirmAction.proposalTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                Will be marked as <span className={`font-semibold ${
                  confirmAction.status === "approved" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>{confirmAction.status}</span>
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
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
                  <CheckCircle2 className="h-4 w-4 mr-2" />
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
                  <XCircle className="h-4 w-4 mr-2" />
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
