"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useRef, useState } from "react";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { ClipboardList, DollarSign } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, formatNumber } from "@/lib/utils";
import { FoundationSnapshot } from "@/lib/types";

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
  const savingRef = useRef(false);

  if (!user || user.role !== "admin") {
    return (
      <GlassCard>
        <CardLabel>Execution Queue Access</CardLabel>
        <p className="mt-2 text-sm text-muted-foreground">Only Brynn (Admin role) can execute approved grants.</p>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <CardLabel>Execution Queue Error</CardLabel>
        <p className="mt-2 text-sm text-rose-600">{error.message}</p>
      </GlassCard>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading execution queue...</p>;
  }

  const markSent = async (proposalId: string) => {
    if (savingRef.current) return;

    const sentAt = sentDateByProposalId[proposalId]?.trim();
    if (!sentAt) {
      setSentErrorByProposalId((current) => ({
        ...current,
        [proposalId]: "Select a Date sent before marking this proposal as Sent."
      }));
      return;
    }

    savingRef.current = true;
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
      void globalMutate("/api/navigation/summary");
      mutateAllFoundation();
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
      savingRef.current = false;
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
      <GlassCard className="rounded-3xl">
        <CardLabel>Administrator Workspace</CardLabel>
        <CardValue>Donation Execution Cues</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Approved grants appear here. Mark as Sent once external donation execution is complete.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatNumber(data.proposals.length)} queued proposal(s)</span>
          <span className="hidden text-border sm:inline">|</span>
          <span>{formatNumber(jointQueued)} joint</span>
          <span className="hidden text-border sm:inline">|</span>
          <span>{formatNumber(discretionaryQueued)} discretionary</span>
        </div>
      </GlassCard>

      <section className="grid gap-3 sm:grid-cols-2">
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
      </section>

      <div className="space-y-3">
        {data.proposals.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-muted-foreground">No approved proposals awaiting execution.</p>
          </GlassCard>
        ) : (
          data.proposals.map((proposal) => {
            const sentDate = sentDateByProposalId[proposal.id] ?? "";
            const errorMessage = sentErrorByProposalId[proposal.id];
            const isSaving = savingProposalId === proposal.id;

            return (
              <GlassCard
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
                    {proposal.organizationName !== "Unknown Organization" &&
                    proposal.organizationName !== proposal.title ? (
                      <p className="mt-1 text-xs text-muted-foreground">{proposal.organizationName}</p>
                    ) : null}

                    <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                      <div className="min-w-0 sm:shrink-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
                          Send amount
                        </p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                          {currency(proposal.progress.computedFinalAmount)}
                        </p>
                      </div>

                      <div className="w-full max-w-full sm:w-[12rem] sm:shrink-0">
                        <label
                          htmlFor={`sent-date-${proposal.id}`}
                          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight"
                        >
                          Date sent
                        </label>
                        <Input
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
                          className="mt-1"
                          required
                        />
                      </div>

                      <Button
                        type="button"
                        variant="prominent"
                        className="w-full sm:w-auto sm:shrink-0 sm:self-end"
                        onClick={() => void markSent(proposal.id)}
                        disabled={!sentDate || isSaving}
                      >
                        {isSaving ? "Saving..." : "Mark as Sent"}
                      </Button>
                    </div>

                    {proposal.organizationWebsite || proposal.charityNavigatorUrl ? (
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
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
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
