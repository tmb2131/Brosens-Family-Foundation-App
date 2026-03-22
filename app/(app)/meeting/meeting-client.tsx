"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { mutateAllFoundation, optimisticMutate } from "@/lib/swr-helpers";
import { AlertTriangle, CheckCircle2, ClipboardList, DollarSign, Eye, EyeOff, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MeetingProposalCard } from "@/components/meeting/meeting-proposal-card";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { StatusPill } from "@/components/ui/status-pill";
import { charityNavigatorRating, currency, formatNumber, titleCase, voteChoiceLabel } from "@/lib/utils";
import { FoundationSnapshot, UserProfile } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageWithSidebar } from "@/components/ui/page-with-sidebar";

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

type CharityNavigatorPreviewState =
  | "preview_available"
  | "missing_ein"
  | "no_score"
  | "config_missing"
  | "upstream_error";

interface CharityNavigatorPreviewResponse {
  state: CharityNavigatorPreviewState;
  normalizedUrl: string | null;
  ein: string | null;
  score: number | null;
  organizationName: string | null;
  message?: string;
}

interface MeetingClientProps {
  profile: UserProfile;
  initialMeeting: MeetingResponse;
}

export default function MeetingClient({ profile, initialMeeting }: MeetingClientProps) {
  const { data, mutate, isLoading, isValidating, error } = useSWR<MeetingResponse>("/api/meeting", {
    refreshInterval: 30_000,
    fallbackData: initialMeeting
  });
  const [activeSegment, setActiveSegment] = useState<MeetingSegment>("ready");
  const [meetingDialogProposalId, setMeetingDialogProposalId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    proposalId: string;
    proposalTitle: string;
    proposalType: string;
    organizationName: string;
    finalAmount: number;
    votesSubmitted: number;
    totalRequiredVotes: number;
    status: "approved" | "declined";
  } | null>(null);
  const [meetingDialogCharityNavigatorPreview, setMeetingDialogCharityNavigatorPreview] =
    useState<CharityNavigatorPreviewResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const meetingDialogProposal =
    meetingDialogProposalId != null
      ? data?.proposals.find((p) => p.id === meetingDialogProposalId) ?? null
      : null;

  const meetingDialogApiOrganizationName =
    meetingDialogCharityNavigatorPreview?.organizationName?.trim() || null;

  useEffect(() => {
    if (!meetingDialogProposal?.charityNavigatorUrl) {
      setMeetingDialogCharityNavigatorPreview(null);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/charity-navigator/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ charityNavigatorUrl: meetingDialogProposal.charityNavigatorUrl })
        });
        if (!response.ok) {
          if (active) {
            setMeetingDialogCharityNavigatorPreview(null);
          }
          return;
        }

        const payload = (await response.json()) as CharityNavigatorPreviewResponse;
        if (active) {
          setMeetingDialogCharityNavigatorPreview(payload);
        }
      } catch {
        if (active) {
          setMeetingDialogCharityNavigatorPreview(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [meetingDialogProposal?.charityNavigatorUrl]);

  if (!["oversight", "manager"].includes(profile.role)) {
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

        <PageWithSidebar
          sticky
          sidebar={
            <div className="grid gap-3">
              <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
              <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
            </div>
          }
        >
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
        </PageWithSidebar>
      </div>
    );
  }

  const updateMeeting = async (payload: Record<string, unknown>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const doFetch = async () => {
      const response = await fetch("/api/meeting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Meeting action failed" }));
        throw new Error(body.error || "Meeting action failed");
      }
    };

    const proposalId = payload.proposalId as string;

    const meetingUpdater = (d: MeetingResponse): MeetingResponse => {
      if (payload.action === "reveal") {
        return {
          ...d,
          proposals: d.proposals.map((p) =>
            p.id === proposalId ? { ...p, revealVotes: payload.reveal as boolean } : p
          ),
        };
      }
      if (payload.action === "decision") {
        return {
          ...d,
          proposals: d.proposals.filter((p) => p.id !== proposalId),
        };
      }
      return d;
    };

    try {
      await optimisticMutate("/api/meeting", doFetch, meetingUpdater);
      await mutateAllFoundation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Meeting action failed");
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

      <PageWithSidebar
        sticky
        sidebar={<div className="grid gap-3">{metricsCards}</div>}
      >
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
                <TabsContent key={segment} value={segment} className="mt-4 space-y-2" role="tabpanel" style={{ animation: "fade-slide-in 220ms ease-out" }}>
                  {segmentProposals[segment].length > 0 ? (
                    <div className="space-y-3">
                      {segmentProposals[segment].map((proposal) => (
                        <MeetingProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          userRole={profile.role}
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

      </PageWithSidebar>

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
                        {meetingDialogApiOrganizationName
                          ? `${meetingDialogApiOrganizationName}'s score is `
                          : "This charity's score is "}
                        {Math.round(meetingDialogProposal.charityNavigatorScore)}%, earning it a{" "}
                        {charityNavigatorRating(meetingDialogProposal.charityNavigatorScore).starLabel} rating.
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
                        proposalType: meetingDialogProposal.proposalType,
                        organizationName: meetingDialogProposal.organizationName,
                        finalAmount: meetingDialogProposal.progress.computedFinalAmount,
                        votesSubmitted: meetingDialogProposal.progress.votesSubmitted,
                        totalRequiredVotes: meetingDialogProposal.progress.totalRequiredVotes,
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
                        proposalType: meetingDialogProposal.proposalType,
                        organizationName: meetingDialogProposal.organizationName,
                        finalAmount: meetingDialogProposal.progress.computedFinalAmount,
                        votesSubmitted: meetingDialogProposal.progress.votesSubmitted,
                        totalRequiredVotes: meetingDialogProposal.progress.totalRequiredVotes,
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 sticky top-0 bg-muted/50 pb-2">
                      Revealed votes ({meetingDialogProposal.voteBreakdown.length})
                    </p>
                    <div className="space-y-2">
                      {meetingDialogProposal.voteBreakdown.map((vote, idx) => {
                        const initial = (vote.userDisplayName?.[0] ?? "?").toUpperCase();
                        const avatarColor =
                          vote.choice === "yes" || vote.choice === "acknowledged"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                            : vote.choice === "no"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
                        const choiceColor =
                          vote.choice === "yes" || vote.choice === "acknowledged"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : vote.choice === "no"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

                        return (
                          <div
                            key={`${meetingDialogProposal.id}-${vote.userId}`}
                            className="rounded-lg border border-border/40 bg-background p-2.5 shadow-sm"
                            style={{
                              animation: `scale-fade-in 280ms ease-out ${idx * 80}ms both`
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}>
                                {initial}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {vote.userDisplayName}
                                  </p>
                                  <p className="text-sm font-bold text-foreground tabular-nums shrink-0">
                                    {currency(vote.allocationAmount)}
                                  </p>
                                </div>
                                <div className="mt-0.5">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${choiceColor}`}>
                                    {voteChoiceLabel(vote.choice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {vote.choice === "flagged" && vote.flagComment ? (
                              <div className="mt-2 ml-10.5 rounded-md bg-amber-50/80 dark:bg-amber-900/20 px-2.5 py-1.5 border-l-2 border-amber-400 dark:border-amber-600">
                                <p className="text-xs text-muted-foreground italic line-clamp-3">
                                  &ldquo;{vote.flagComment}&rdquo;
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/30 bg-muted/30 p-4 text-center">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 mb-2">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </div>
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
            dialogClassName="max-w-md rounded-3xl overflow-hidden"
            showCloseButton={false}
          >
            {/* Status banner */}
            <div className={`px-6 pt-6 pb-4 ${
              confirmAction.status === "approved"
                ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20"
                : "bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-rose-900/20"
            }`}>
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    confirmAction.status === "approved"
                      ? "bg-emerald-200/80 text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-300"
                      : "bg-rose-200/80 text-rose-700 dark:bg-rose-800/60 dark:text-rose-300"
                  }`}
                  style={{ animation: "scale-fade-in 300ms ease-out" }}
                >
                  {confirmAction.status === "approved" ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h2
                    id="confirm-decision-title"
                    className="text-lg font-semibold"
                  >
                    {confirmAction.status === "approved" ? "Approve" : "Decline"} Proposal?
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Final decision for this grant
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              {/* Proposal summary card */}
              <div className="mt-4 mb-3 p-3 rounded-xl border border-border/70 bg-muted/30">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {confirmAction.proposalTitle}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{confirmAction.organizationName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    {titleCase(confirmAction.proposalType)}
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {currency(confirmAction.finalAmount)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatNumber(confirmAction.votesSubmitted)}/{formatNumber(confirmAction.totalRequiredVotes)} votes
                  </span>
                </div>
              </div>

              {/* Caution strip */}
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  This action cannot be undone
                </p>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={saving}
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </Button>
                {confirmAction.status === "approved" ? (
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-600/90 hover:to-emerald-500/90 text-white shadow-md"
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
                    size="lg"
                    className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-600/90 hover:to-rose-500/90 text-white shadow-md"
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
            </div>
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>
    </div>
  );
}
