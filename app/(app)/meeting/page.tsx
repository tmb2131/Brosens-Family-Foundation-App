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
    refreshInterval: 8_000
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
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <CardTitle>Reveal & Decision Stage</CardTitle>
        <CardValue>Live Meeting Sync</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Unmask blind votes during the meeting, then log the final decision to trigger execution for Brynn.
        </p>
      </Card>

      <div className="space-y-3">
        {data.proposals.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500">No proposals pending review.</p>
          </Card>
        ) : (
          data.proposals.map((proposal) => (
            <Card key={proposal.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{proposal.title}</h3>
                  <p className="text-xs text-zinc-500">
                    {formatNumber(proposal.progress.votesSubmitted)} of{" "}
                    {formatNumber(proposal.progress.totalRequiredVotes)} votes in
                  </p>
                </div>
                <StatusPill status={proposal.status} />
              </div>

              <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                <p>Type: {titleCase(proposal.proposalType)}</p>
                <p>
                  Rule:{" "}
                  {proposal.proposalType === "joint"
                    ? titleCase(proposal.allocationMode)
                    : "Proposer-set amount"}
                </p>
                <p>Recommended amount: {currency(proposal.progress.computedFinalAmount)}</p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold sm:text-xs"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: true })}
                >
                  Reveal Votes
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold sm:text-xs"
                  onClick={() => void updateMeeting({ action: "reveal", proposalId: proposal.id, reveal: false })}
                >
                  Mask Again
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white sm:text-xs"
                  onClick={() => void updateMeeting({ action: "decision", proposalId: proposal.id, status: "approved" })}
                >
                  Confirm Approved
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white sm:text-xs"
                  onClick={() => void updateMeeting({ action: "decision", proposalId: proposal.id, status: "declined" })}
                >
                  Confirm Declined
                </button>
              </div>

              {proposal.revealVotes ? (
                <div className="mt-3 rounded-xl border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Revealed blind votes
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    {proposal.voteBreakdown.map((vote) => (
                      <p key={`${proposal.id}-${vote.userId}`}>
                        {vote.userId}: {voteChoiceLabel(vote.choice)} ({currency(vote.allocationAmount)})
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">Votes remain masked until reveal.</p>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
