"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { CheckCircle2, ClipboardList, DollarSign, Eye, EyeOff, PieChart, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, formatNumber, titleCase, voteChoiceLabel } from "@/lib/utils";
import { FoundationSnapshot } from "@/lib/types";

interface MeetingResponse {
  proposals: FoundationSnapshot["proposals"];
}

export default function MeetingPage() {
  const { user } = useAuth();
  const { data, mutate, isLoading, error } = useSWR<MeetingResponse>("/api/meeting", {
    refreshInterval: 30_000
  });

  if (!user || !["oversight", "manager"].includes(user.role)) {
    return (
      <Card>
        <CardTitle>Meeting Sync Access</CardTitle>
        <p className="mt-2 text-sm text-zinc-500">
          This view is reserved for process oversight and foundation manager roles.
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardTitle>Meeting Sync Error</CardTitle>
        <p className="mt-2 text-sm text-rose-600">{error.message}</p>
      </Card>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-zinc-500">Loading meeting sync view...</p>;
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
      <Card className="hidden rounded-3xl sm:block">
        <CardTitle>Reveal & Decision Stage</CardTitle>
        <CardValue>Live Meeting Sync</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <span className="status-dot bg-emerald-500" />
          Unmask blind votes during the meeting, then log the final decision to trigger execution for Brynn.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
          <span>{formatNumber(data.proposals.length)} pending</span>
          <span className="hidden text-zinc-300 dark:text-zinc-600 sm:inline">|</span>
          <span>{formatNumber(jointCount)} joint</span>
          <span className="hidden text-zinc-300 dark:text-zinc-600 sm:inline">|</span>
          <span>{formatNumber(discretionaryCount)} discretionary</span>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <MetricCard
          title="AVERAGE RECOMMENDED"
          value={currency(data.proposals.length ? totalRecommendedAmount / data.proposals.length : 0)}
          icon={PieChart}
          tone="emerald"
        />
      </section>

      <div className="space-y-3">
        {data.proposals.length === 0 ? (
          <Card className="p-3 sm:p-4">
            <p className="text-sm text-zinc-500">No proposals pending review.</p>
          </Card>
        ) : (
          data.proposals.map((proposal) => (
            <Card
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
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatNumber(proposal.progress.votesSubmitted)} of{" "}
                    {formatNumber(proposal.progress.totalRequiredVotes)} votes in
                  </p>
                </div>
                <StatusPill status={proposal.status} />
              </div>
              <p className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                {currency(proposal.progress.computedFinalAmount)}
              </p>

              <div className="mt-2 grid gap-1 text-xs text-zinc-500 sm:mt-3 sm:gap-2 sm:grid-cols-3">
                <p className="truncate">Type: {titleCase(proposal.proposalType)}</p>
                <p>
                  Rule:{" "}
                  {proposal.proposalType === "joint"
                    ? titleCase(proposal.allocationMode)
                    : "Proposer-set amount"}
                </p>
                <p className="font-medium text-zinc-600 dark:text-zinc-300">
                  Recommended: {currency(proposal.progress.computedFinalAmount)}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: true })}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Reveal Votes
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: false })}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Mask Again
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "decision", proposalId: proposal.id, status: "approved" })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm Approved
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-rose-600 px-2 py-2 text-xs font-semibold text-white sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "decision", proposalId: proposal.id, status: "declined" })}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Confirm Declined
                </button>
              </div>

              {proposal.revealVotes ? (
                <div className="mt-3 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-700/50 dark:bg-zinc-800/30">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
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
                <p className="mt-3 text-[11px] text-zinc-500 sm:text-xs">
                  Votes remain masked until reveal.
                </p>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
