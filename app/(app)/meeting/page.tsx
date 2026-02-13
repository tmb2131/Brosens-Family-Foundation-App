"use client";

import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
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
  };

  return (
    <div className="space-y-2 pb-3 sm:space-y-4 sm:pb-4">
      <Card className="hidden rounded-3xl sm:block">
        <CardTitle>Reveal & Decision Stage</CardTitle>
        <CardValue>Live Meeting Sync</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Unmask blind votes during the meeting, then log the final decision to trigger execution for Brynn.
        </p>
      </Card>

      <div className="space-y-2 sm:space-y-3">
        {data.proposals.length === 0 ? (
          <Card className="p-3 sm:p-4">
            <p className="text-sm text-zinc-500">No proposals pending review.</p>
          </Card>
        ) : (
          data.proposals.map((proposal) => (
            <Card key={proposal.id} className="p-3 sm:p-4">
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

              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:gap-2">
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: true })}
                >
                  <span className="sm:hidden">Reveal</span>
                  <span className="hidden sm:inline">Reveal Votes</span>
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: false })}
                >
                  <span className="sm:hidden">Mask</span>
                  <span className="hidden sm:inline">Mask Again</span>
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "decision", proposalId: proposal.id, status: "approved" })}
                >
                  <span className="sm:hidden">Approve</span>
                  <span className="hidden sm:inline">Confirm Approved</span>
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-lg bg-rose-600 px-2 py-2 text-xs font-semibold text-white sm:min-h-11 sm:px-3"
                  onClick={() => void updateMeeting({ action: "decision", proposalId: proposal.id, status: "declined" })}
                >
                  <span className="sm:hidden">Decline</span>
                  <span className="hidden sm:inline">Confirm Declined</span>
                </button>
              </div>

              {proposal.revealVotes ? (
                <div className="mt-2 rounded-lg border p-2.5 sm:mt-3 sm:rounded-xl sm:p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Revealed votes</p>
                  <div className="mt-1.5 space-y-1 text-xs sm:mt-2 sm:text-sm">
                    {proposal.voteBreakdown.map((vote) => (
                      <p key={`${proposal.id}-${vote.userId}`}>
                        {vote.userId}: {voteChoiceLabel(vote.choice)} ({currency(vote.allocationAmount)})
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-500 sm:mt-3 sm:text-xs">
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
