"use client";

import useSWR from "swr";
import { useState } from "react";
import { ClipboardList, DollarSign, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, formatNumber } from "@/lib/utils";
import { DIRECTIONAL_CATEGORY_LABELS, FoundationSnapshot } from "@/lib/types";

interface AdminQueueResponse {
  proposals: FoundationSnapshot["proposals"];
}

export default function AdminPage() {
  const { user } = useAuth();
  const { data, mutate, isLoading, error } = useSWR<AdminQueueResponse>("/api/admin", {
    refreshInterval: 30_000
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

  const totalQueuedAmount = data.proposals.reduce(
    (sum, proposal) => sum + proposal.progress.computedFinalAmount,
    0
  );
  const jointQueued = data.proposals.filter((proposal) => proposal.proposalType === "joint").length;
  const discretionaryQueued = data.proposals.length - jointQueued;

  return (
    <div className="page-stack pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-8">
      <Card className="rounded-3xl">
        <CardTitle>Administrator Workspace</CardTitle>
        <CardValue>Donation Execution Cues</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <span className="status-dot bg-emerald-500" />
          Approved grants appear here. Mark as Sent once external donation execution is complete.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
          <span>{formatNumber(data.proposals.length)} queued proposal(s)</span>
          <span className="hidden text-zinc-300 dark:text-zinc-600 sm:inline">|</span>
          <span>{formatNumber(jointQueued)} joint</span>
          <span className="hidden text-zinc-300 dark:text-zinc-600 sm:inline">|</span>
          <span>{formatNumber(discretionaryQueued)} discretionary</span>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          title="QUEUE SIZE"
          value={formatNumber(data.proposals.length)}
          icon={ClipboardList}
          tone="emerald"
        />
        <MetricCard
          title="TOTAL TO SEND"
          value={currency(totalQueuedAmount)}
          icon={DollarSign}
          tone="indigo"
        />
        <MetricCard
          title="AVERAGE AMOUNT"
          value={currency(data.proposals.length ? totalQueuedAmount / data.proposals.length : 0)}
          icon={Wallet}
          tone="amber"
        />
      </section>

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
              <Card
                key={proposal.id}
                className={`border-t-2 ${
                  proposal.proposalType === "joint"
                    ? "border-t-indigo-400 dark:border-t-indigo-500"
                    : "border-t-amber-400 dark:border-t-amber-500"
                }`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold">{proposal.title}</h3>
                    {proposal.organizationName !== "Unknown Organization" ? (
                      <p className="mt-1 text-xs text-zinc-500">{proposal.organizationName}</p>
                    ) : null}
                    <p className="mt-1 inline-flex items-center rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                      {DIRECTIONAL_CATEGORY_LABELS[proposal.organizationDirectionalCategory]}
                    </p>

                    <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                      <div className="min-w-0 sm:shrink-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 leading-tight">
                          Send amount
                        </p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                          {currency(proposal.progress.computedFinalAmount)}
                        </p>
                      </div>

                      <div className="w-full max-w-full sm:w-[12rem] sm:shrink-0">
                        <label
                          htmlFor={`sent-date-${proposal.id}`}
                          className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 leading-tight"
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
                          className="field-control field-control--compact mt-1 block h-9 w-full min-w-0"
                          required
                        />
                      </div>

                      <button
                        type="button"
                        className="prominent-accent-cta w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:shrink-0 sm:self-end"
                        onClick={() => void markSent(proposal.id)}
                        disabled={!sentDate || isSaving}
                      >
                        {isSaving ? "Saving..." : "Mark as Sent"}
                      </button>
                    </div>

                    {proposal.organizationWebsite || proposal.charityNavigatorUrl ? (
                      <div className="mt-3 space-y-1 text-xs text-zinc-600">
                        {proposal.organizationWebsite ? (
                          <p className="break-all">
                            Organization website:{" "}
                            <a
                              href={proposal.organizationWebsite}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 dark:text-indigo-300 dark:decoration-indigo-500"
                            >
                              {proposal.organizationWebsite}
                            </a>
                          </p>
                        ) : null}
                        {proposal.charityNavigatorUrl ? (
                          <p className="break-all">
                            Charity Navigator:{" "}
                            <a
                              href={proposal.charityNavigatorUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 dark:text-indigo-300 dark:decoration-indigo-500"
                            >
                              {proposal.charityNavigatorUrl}
                            </a>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <StatusPill status={proposal.status} />
                </div>

                {errorMessage ? <p className="mt-2 text-xs text-rose-600">{errorMessage}</p> : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
