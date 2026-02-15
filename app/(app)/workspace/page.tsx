"use client";

import Link from "next/link";
import useSWR from "swr";
import { Gift, History, ListChecks, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { WorkspaceSnapshot } from "@/lib/types";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { currency, formatNumber, titleCase, voteChoiceLabel } from "@/lib/utils";
import { VoteForm } from "@/components/voting/vote-form";
import { StatusPill } from "@/components/ui/status-pill";

export default function WorkspacePage() {
  const { user } = useAuth();

  const workspaceQuery = useSWR<WorkspaceSnapshot>(
    user ? "/api/workspace" : null,
    { refreshInterval: 30_000 }
  );

  if (workspaceQuery.isLoading) {
    return (
      <div className="page-stack pb-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (workspaceQuery.error || !workspaceQuery.data) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-rose-600">
          Failed to load workspace data
          {workspaceQuery.error ? `: ${workspaceQuery.error.message}` : "."}
        </p>
        <Button
          variant="outline"
          size="lg"
          className="mt-3"
          onClick={() => void workspaceQuery.mutate()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </GlassCard>
    );
  }

  const workspace = workspaceQuery.data;
  const isManager = workspace.user.role === "manager";
  const totalIndividualAllocated =
    workspace.personalBudget.jointAllocated + workspace.personalBudget.discretionaryAllocated;
  const totalIndividualTarget = workspace.personalBudget.jointTarget + workspace.personalBudget.discretionaryCap;

  return (
    <div className="page-stack pb-4">
      <section className="grid gap-3 xl:grid-cols-[2fr_1fr]">
        <GlassCard className="rounded-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardLabel>My Workspace</CardLabel>
              <CardValue>{workspace.user.name}</CardValue>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {isManager
                  ? "Track action items, submitted proposals, and voting history. Manager profiles do not have individual budgets."
                  : "Track your joint/discretionary balances, action items, and personal voting history."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
                <span>{formatNumber(workspace.actionItems.length)} action item(s)</span>
                <span className="hidden text-zinc-300 dark:text-zinc-600 sm:inline">|</span>
                <span>{formatNumber(workspace.submittedGifts.length)} submitted proposal(s)</span>
              </div>
            </div>
            <Button variant="proposal" asChild className="sm:min-h-11 sm:px-4 sm:text-sm">
              <Link href="/proposals/new">
                <Plus className="h-4 w-4" /> New Proposal
              </Link>
            </Button>
          </div>
        </GlassCard>
        {isManager ? (
          <GlassCard className="rounded-3xl">
            <CardLabel>Individual Budget</CardLabel>
            <p className="mt-1 text-sm text-zinc-500">
              Managers do not have an individual budget. Joint proposals are still available.
            </p>
          </GlassCard>
        ) : (
          <PersonalBudgetBars
            title="Total Individual Budget Tracker"
            allocated={totalIndividualAllocated}
            total={totalIndividualTarget}
          />
        )}
      </section>

      {!isManager ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <PersonalBudgetBars
            title="Joint Budget Tracker"
            allocated={workspace.personalBudget.jointAllocated}
            total={workspace.personalBudget.jointTarget}
          />
          <PersonalBudgetBars
            title="Discretionary Budget Tracker"
            allocated={workspace.personalBudget.discretionaryAllocated}
            total={workspace.personalBudget.discretionaryCap}
          />
        </section>
      ) : null}

      <GlassCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <ListChecks className="h-4 w-4" />
            </span>
            <CardLabel>Action Items</CardLabel>
          </div>
          <Link href="/dashboard" className="inline-flex min-h-10 items-center text-xs font-semibold text-accent">
            Open full tracker
          </Link>
        </div>

        <div className="space-y-3">
          {workspace.actionItems.length === 0 ? (
            <p className="text-sm text-zinc-500">No vote-required items right now.</p>
          ) : (
            workspace.actionItems.map((item) => {
              if (!user) {
                return null;
              }

              return (
                <article
                  key={item.proposalId}
                  className={`rounded-xl border border-t-2 p-4 ${
                    item.proposalType === "joint"
                      ? "border-t-indigo-400 dark:border-t-indigo-500"
                      : "border-t-amber-400 dark:border-t-amber-500"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <p className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                    {currency(item.proposedAmount)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500">Type</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">
                        {titleCase(item.proposalType)}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500">Progress</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">
                        {item.voteProgressLabel}
                      </p>
                    </div>
                  </div>
                  <VoteForm
                    proposalId={item.proposalId}
                    proposalType={item.proposalType}
                    proposedAmount={item.proposedAmount}
                    totalRequiredVotes={item.totalRequiredVotes}
                    onSuccess={() => {
                      void workspaceQuery.mutate();
                    }}
                  />
                </article>
              );
            })
          )}
        </div>
      </GlassCard>

      <section className="grid gap-3 lg:grid-cols-2">
        <GlassCard>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              <History className="h-4 w-4" />
            </span>
            <CardLabel>Personal History</CardLabel>
          </div>
          <div className="mt-3 space-y-2">
            {workspace.voteHistory.map((vote) => (
              <div
                key={`${vote.proposalId}-${vote.at}`}
                className="rounded-xl border border-zinc-200/80 p-2 transition-colors hover:bg-zinc-50/70 dark:border-zinc-700 dark:hover:bg-zinc-800/40"
              >
                <p className="text-sm font-medium">{vote.proposalTitle}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {voteChoiceLabel(vote.choice)} | {currency(vote.amount)}
                </p>
                <p className="text-xs text-zinc-500">{new Date(vote.at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Gift className="h-4 w-4" />
            </span>
            <CardLabel>My Submitted Gifts</CardLabel>
          </div>
          <div className="mt-3 space-y-2">
            {workspace.submittedGifts.length === 0 ? (
              <p className="text-sm text-zinc-500">No submitted gifts yet.</p>
            ) : (
              workspace.submittedGifts.map((proposal) => (
                <div
                  key={proposal.id}
                  className="rounded-xl border border-zinc-200/80 p-2 transition-colors hover:bg-zinc-50/70 dark:border-zinc-700 dark:hover:bg-zinc-800/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{proposal.title}</p>
                    <StatusPill status={proposal.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Budget Year: {proposal.budgetYear}</p>
                  <p className="text-xs text-zinc-500">Amount: {currency(proposal.proposedAmount)}</p>
                  <p className="mt-1 text-xs text-zinc-500">{proposal.description}</p>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
