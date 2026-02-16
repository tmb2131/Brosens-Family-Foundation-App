"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
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

interface MeetingResponse {
  proposals: FoundationSnapshot["proposals"];
}

export default function MeetingPage() {
  const { user } = useAuth();
  const { data, mutate, isLoading, error } = useSWR<MeetingResponse>("/api/meeting", {
    refreshInterval: 30_000
  });
  const [confirmAction, setConfirmAction] = useState<{
    proposalId: string;
    proposalTitle: string;
    status: "approved" | "declined";
  } | null>(null);

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
    await fetch("/api/meeting", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    await mutate();
    void globalMutate("/api/navigation/summary");
  };

  const totalRecommendedAmount = data.proposals.reduce(
    (sum, proposal) => sum + proposal.progress.computedFinalAmount,
    0
  );
  const jointCount = data.proposals.filter((proposal) => proposal.proposalType === "joint").length;
  const discretionaryCount = data.proposals.length - jointCount;

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

      <div className="space-y-3">
        {data.proposals.length === 0 ? (
          <GlassCard className="p-3 sm:p-4">
            <p className="text-sm text-muted-foreground">No proposals pending review.</p>
          </GlassCard>
        ) : (
          data.proposals.map((proposal) => (
            <GlassCard
              key={proposal.id}
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

              {user.role === "oversight" && proposal.charityNavigatorUrl ? (
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

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: true })}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Reveal Votes
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: false })}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Mask Again
                </Button>
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-600/90"
                  onClick={() => setConfirmAction({ proposalId: proposal.id, proposalTitle: proposal.title, status: "approved" })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm Approved
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => setConfirmAction({ proposalId: proposal.id, proposalTitle: proposal.title, status: "declined" })}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Confirm Declined
                </Button>
              </div>

              {proposal.revealVotes ? (
                <div className="mt-3 rounded-xl border border-border/70 bg-muted/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Revealed votes
                  </p>
                  <div className="mt-1.5 space-y-1 text-xs sm:mt-2 sm:text-sm">
                    {proposal.voteBreakdown.map((vote) => (
                      <p key={`${proposal.id}-${vote.userId}`}>
                        {vote.userId}: {voteChoiceLabel(vote.choice)} ({currency(vote.allocationAmount)})
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground sm:text-xs">
                  Votes remain masked until reveal.
                </p>
              )}
            </GlassCard>
          ))
        )}
      </div>

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
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
              {confirmAction.status === "approved" ? (
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-600/90"
                  onClick={() => {
                    void updateMeeting({ action: "decision", proposalId: confirmAction.proposalId, status: "approved" });
                    setConfirmAction(null);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    void updateMeeting({ action: "decision", proposalId: confirmAction.proposalId, status: "declined" });
                    setConfirmAction(null);
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Decline
                </Button>
              )}
            </div>
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>
    </div>
  );
}
