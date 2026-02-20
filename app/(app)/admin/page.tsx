"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { AlertCircle, CheckCircle2, ClipboardList, ExternalLink, Inbox, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, currency, formatNumber, toISODate, titleCase } from "@/lib/utils";
import { AdminQueueProposal } from "@/lib/foundation-data";

interface AdminQueueResponse {
  proposals: AdminQueueProposal[];
}

function AdminPageClient() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const proposalIdFromUrl = searchParams.get("proposalId")?.trim() ?? null;
  const adminQueueKey = user?.role === "admin" ? "/api/admin" : null;
  const { data, mutate, isLoading, error } = useSWR<AdminQueueResponse>(adminQueueKey, {
    refreshInterval: 30_000
  });
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightProposalId, setHighlightProposalId] = useState<string | null>(null);
  const todayISO = toISODate(new Date());
  const [sentDateByProposalId, setSentDateByProposalId] = useState<Record<string, string>>({});
  const [sentErrorByProposalId, setSentErrorByProposalId] = useState<Record<string, string>>({});
  const [savingProposalId, setSavingProposalId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!data?.proposals?.length || !proposalIdFromUrl) return;
    const found = data.proposals.some((p) => p.id === proposalIdFromUrl);
    if (!found) return;
    const el = cardRefs.current[proposalIdFromUrl];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightProposalId(proposalIdFromUrl);
      const t = setTimeout(() => setHighlightProposalId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [data?.proposals, proposalIdFromUrl]);

  if (authLoading) {
    return (
      <div className="page-stack pb-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

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

      toast.success("Marked as sent");
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

  const distinctBudgetYears = new Set(data.proposals.map((p) => p.budgetYear)).size;

  return (
    <div className="page-stack pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-8">
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-3">
          <GlassCard className="rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardLabel>Administrator Workspace</CardLabel>
                <CardValue>Donation Execution Queue</CardValue>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Approved grants appear here. Mark as Sent once external donation execution is complete.
                </p>
              </div>
              <ThemeToggle className="h-8 w-8 shrink-0 rounded-lg border bg-card sm:h-9 sm:w-9" />
            </div>
          </GlassCard>

          <GlassCard className="p-3 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <ClipboardList className="h-4 w-4" />
              </span>
              <CardLabel>Queue <span className="font-semibold">Summary</span></CardLabel>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Queue Size</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {formatNumber(data.proposals.length)}
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total to Send</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {currency(totalQueuedAmount)}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-border/80 bg-muted/30 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Budget Years</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {distinctBudgetYears === 0 ? "—" : distinctBudgetYears === 1
                    ? `${[...new Set(data.proposals.map((p) => p.budgetYear))][0]}`
                    : `${distinctBudgetYears} years`}
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="space-y-3">
        {data.proposals.length === 0 ? (
          <GlassCard>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Inbox className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Queue is clear</p>
                <p className="mt-0.5 text-xs text-muted-foreground">No approved proposals awaiting execution.</p>
              </div>
            </div>
          </GlassCard>
        ) : (
          data.proposals.map((proposal) => {
            const sentDate = sentDateByProposalId[proposal.id] ?? todayISO;
            const errorMessage = sentErrorByProposalId[proposal.id];
            const isSaving = savingProposalId === proposal.id;
            const errorId = `sent-error-${proposal.id}`;

            return (
              <div
                key={proposal.id}
                ref={(el) => {
                  cardRefs.current[proposal.id] = el;
                }}
                className={cn(
                  highlightProposalId === proposal.id && "rounded-3xl ring-2 ring-emerald-500 ring-offset-2 transition"
                )}
                aria-busy={isSaving}
              >
                <GlassCard
                  className={cn(
                    "border-t-2",
                    proposal.proposalType === "joint"
                      ? "border-t-indigo-400 dark:border-t-indigo-500"
                      : "border-t-amber-400 dark:border-t-amber-500"
                  )}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold">{proposal.title}</h3>
                      {proposal.organizationName !== "Unknown Organization" &&
                      proposal.organizationName !== proposal.title ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{proposal.organizationName}</p>
                      ) : null}

                      <div className="mt-3 rounded-2xl border-2 border-border bg-muted/30 p-4 sm:border-0 sm:bg-transparent sm:p-0">
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3 lg:flex-nowrap lg:items-start">
                          <div className="flex min-w-0 flex-row flex-wrap items-end gap-2 sm:gap-3 lg:flex-1 lg:flex-nowrap lg:items-start">
                            <div className="min-w-0 shrink-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
                                Send amount
                              </p>
                              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                {currency(proposal.progress.computedFinalAmount)}
                              </p>
                            </div>

                            <div className="min-w-0 shrink-0 sm:w-[12rem]">
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
                                className="mt-1 w-[10.5rem] max-sm:border-border/60 max-sm:bg-background/50"
                                required
                                disabled={isSaving}
                              />
                            </div>
                          </div>

                          <div className="flex shrink-0 justify-end sm:justify-start lg:justify-end lg:self-end">
                            <Button
                              type="button"
                              variant="prominent"
                              className="min-h-[44px] min-w-[7rem] shrink-0 py-3 sm:w-auto sm:py-2"
                              onClick={() => void markSent(proposal.id)}
                              disabled={!sentDate || isSaving}
                              aria-describedby={errorMessage ? errorId : undefined}
                            >
                              {isSaving ? "Saving..." : "Mark as Sent"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 shrink-0" aria-hidden />
                          <span>
                            {proposal.progress.votesSubmitted} / {proposal.progress.totalRequiredVotes} votes
                          </span>
                          {proposal.progress.votesSubmitted >= proposal.progress.totalRequiredVotes ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
                          ) : null}
                        </div>
                        {proposal.proposerDisplay ? (
                          <p>
                            Proposed by{" "}
                            <span className="font-medium text-foreground">{proposal.proposerDisplay}</span>
                          </p>
                        ) : null}
                        {proposal.organizationWebsite ? (
                          <p className="flex items-center gap-1 break-all">
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
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
                          <p className="flex items-center gap-1 break-all">
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                            <a
                              href={proposal.charityNavigatorUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 dark:text-indigo-300 dark:decoration-indigo-500"
                            >
                              Charity Navigator
                            </a>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <StatusPill status={proposal.status} />
                  </div>

                  {errorMessage ? (
                    <p
                      id={errorId}
                      role="alert"
                      className="mt-2 flex items-center gap-1.5 text-xs text-rose-600"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {errorMessage}
                    </p>
                  ) : null}
                </GlassCard>
              </div>
            );
          })
        )}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="lg:sticky lg:top-6">
            <GlassCard className="p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <CardLabel>Queue <span className="font-semibold">Summary</span></CardLabel>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Queue Size</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {formatNumber(data.proposals.length)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total to Send</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {currency(totalQueuedAmount)}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-border/80 bg-muted/30 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Budget Years</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {distinctBudgetYears === 0 ? "—" : distinctBudgetYears === 1
                      ? `${[...new Set(data.proposals.map((p) => p.budgetYear))][0]}`
                      : `${distinctBudgetYears} years`}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

const AdminPageFallback = () => (
  <div className="page-stack pb-4">
    <SkeletonCard />
    <SkeletonCard />
  </div>
);

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminPageFallback />}>
      <AdminPageClient />
    </Suspense>
  );
}
