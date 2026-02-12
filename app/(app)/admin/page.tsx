"use client";

import useSWR from "swr";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { currency } from "@/lib/utils";
import { FoundationSnapshot } from "@/lib/types";

interface AdminQueueResponse {
  proposals: FoundationSnapshot["proposals"];
}

export default function AdminPage() {
  const { user } = useAuth();
  const { data, mutate, isLoading, error } = useSWR<AdminQueueResponse>("/api/admin", {
    refreshInterval: 8_000
  });
  const [sentDateByProposalId, setSentDateByProposalId] = useState<Record<string, string>>({});
  const [sentErrorByProposalId, setSentErrorByProposalId] = useState<Record<string, string>>({});
  const [savingProposalId, setSavingProposalId] = useState<string | null>(null);

  if (!user || user.role !== "admin") {
    return (
      <Card>
        <CardTitle>Execution Queue Access</CardTitle>
        <p className="mt-2 text-sm text-zinc-500">Only Brynn (Admin role) can execute approved grants.</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardTitle>Execution Queue Error</CardTitle>
        <p className="mt-2 text-sm text-rose-600">{error.message}</p>
      </Card>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-zinc-500">Loading execution queue...</p>;
  }

  const markSent = async (proposalId: string) => {
    const sentAt = sentDateByProposalId[proposalId]?.trim();
    if (!sentAt) {
      setSentErrorByProposalId((current) => ({
        ...current,
        [proposalId]: "Select a Date sent before marking this proposal as Sent."
      }));
      return;
    }

    setSavingProposalId(proposalId);
    setSentErrorByProposalId((current) => {
      const next = { ...current };
      delete next[proposalId];
      return next;
    });

    try {
      const response = await fetch("/api/meeting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "decision", proposalId, status: "sent", sentAt })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? "Could not mark proposal as Sent.");
      }

      await mutate();
      setSentDateByProposalId((current) => {
        const next = { ...current };
        delete next[proposalId];
        return next;
      });
    } catch (submissionError) {
      setSentErrorByProposalId((current) => ({
        ...current,
        [proposalId]:
          submissionError instanceof Error
            ? submissionError.message
            : "Could not mark proposal as Sent."
      }));
    } finally {
      setSavingProposalId((current) => (current === proposalId ? null : current));
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <CardTitle>Administrator Workspace</CardTitle>
        <CardValue>Donation Execution Cues</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Approved grants appear here. Mark as Sent once external donation execution is complete.
        </p>
      </Card>

      <div className="space-y-3">
        {data.proposals.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500">No approved proposals awaiting execution.</p>
          </Card>
        ) : (
          data.proposals.map((proposal) => {
            const sentDate = sentDateByProposalId[proposal.id] ?? "";
            const errorMessage = sentErrorByProposalId[proposal.id];
            const isSaving = savingProposalId === proposal.id;

            return (
              <Card key={proposal.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{proposal.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Final amount: {currency(proposal.progress.computedFinalAmount)}
                    </p>
                  </div>
                  <StatusPill status={proposal.status} />
                </div>

                <div className="mt-3">
                  <label
                    htmlFor={`sent-date-${proposal.id}`}
                    className="block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    Date sent
                  </label>
                  <input
                    id={`sent-date-${proposal.id}`}
                    type="date"
                    value={sentDate}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSentDateByProposalId((current) => ({
                        ...current,
                        [proposal.id]: value
                      }));
                      setSentErrorByProposalId((current) => {
                        const next = { ...current };
                        delete next[proposal.id];
                        return next;
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                </div>

                {errorMessage ? <p className="mt-2 text-xs text-rose-600">{errorMessage}</p> : null}

                <button
                  type="button"
                  className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
                  onClick={() => void markSent(proposal.id)}
                  disabled={!sentDate || isSaving}
                >
                  {isSaving ? "Saving..." : "Mark as Sent"}
                </button>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
