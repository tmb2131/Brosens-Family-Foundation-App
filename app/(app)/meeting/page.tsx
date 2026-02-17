"use client";

import { useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { CheckCircle2, ClipboardList, DollarSign, Eye, EyeOff, RefreshCw, XCircle } from "lucide-react";
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
  return (
    <GlassCard
      className={`border-t-2 p-4 ${
        proposal.proposalType === "joint"
          ? "border-t-indigo-400 dark:border-t-indigo-500"
          : "border-t-amber-400 dark:border-t-amber-500"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{proposal.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(proposal.progress.votesSubmitted)} of{" "}
            {formatNumber(proposal.progress.totalRequiredVotes)} votes in
          </p>
        </div>
        <StatusPill status={proposal.status} />
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">
        {currency(proposal.progress.computedFinalAmount)}
      </p>

      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:mt-3 sm:gap-2 sm:grid-cols-3">
        <p className="truncate">Type: {titleCase(proposal.proposalType)}</p>
        <p>
          Rule:{" "}
          {proposal.proposalType === "joint"
            ? titleCase(proposal.allocationMode)
            : "Proposer-set amount"}
        </p>
        <p className="font-medium text-muted-foreground">
          Recommended: {currency(proposal.progress.computedFinalAmount)}
        </p>
      </div>

      {proposal.voteBreakdown.some((v) => v.choice === "flagged" && v.flagComment) ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
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
        <div className="mt-3 rounded-xl border border-border/70 bg-muted/60 p-3 text-xs">
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

      <Button
        className="mt-3 w-full sm:w-auto"
        size="lg"
        disabled={saving}
        onClick={() => onOpenDecisionDialog(proposal.id)}
      >
        <Eye className="h-3.5 w-3.5" />
        Reveal & decide
      </Button>
    </GlassCard>
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

  return (
    <div className="page-stack pb-4">
      <GlassCard className="rounded-3xl">
        <CardLabel>Reveal & Decision Stage</CardLabel>
        <CardValue className="hidden sm:block">Live Meeting Sync</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="hidden sm:inline">Unmask blind votes during the meeting, then log the final decision to trigger execution for Brynn.</span>
          <span className="sm:hidden">{formatNumber(data.proposals.length)} pending decisions</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatNumber(data.proposals.length)} pending</span>
          <span className="hidden text-border sm:inline">|</span>
          <span>{formatNumber(jointCount)} joint</span>
          <span className="hidden text-border sm:inline">|</span>
          <span>{formatNumber(discretionaryCount)} discretionary</span>
        </div>
      </GlassCard>

      <section className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          title="PENDING DECISIONS"
          value={formatNumber(data.proposals.length)}
          icon={ClipboardList}
          tone="sky"
        />
        <MetricCard
          title="RECOMMENDED TOTAL"
          value={currency(totalRecommendedAmount)}
          icon={DollarSign}
          tone="indigo"
        />
      </section>

      <Tabs value={activeSegment} onValueChange={(value) => setActiveSegment(value as MeetingSegment)}>
        <TabsList className="h-auto w-full flex-wrap gap-2 rounded-none border-0 bg-transparent p-0 shadow-none">
          <TabsTrigger
            value="ready"
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Ready ({formatNumber(readyProposals.length)})
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Pending ({formatNumber(pendingProposals.length)})
          </TabsTrigger>
          <TabsTrigger
            value="needs_discussion"
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Needs discussion ({formatNumber(needsDiscussionProposals.length)})
          </TabsTrigger>
        </TabsList>
        {(["ready", "pending", "needs_discussion"] as const).map((segment) => (
          <TabsContent key={segment} value={segment} className="mt-3 space-y-3">
            {segmentProposals[segment].length === 0 ? (
              <GlassCard className="p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">No proposals in this segment.</p>
              </GlassCard>
            ) : (
              segmentProposals[segment].map((proposal) => (
                <MeetingProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  userRole={user.role}
                  saving={saving}
                  onOpenDecisionDialog={setMeetingDialogProposalId}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

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
