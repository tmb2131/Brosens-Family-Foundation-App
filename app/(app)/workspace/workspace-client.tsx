"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { Gift, History, ListChecks, Plus, RefreshCw, Vote } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { WorkspaceSnapshot } from "@/lib/types";
import { Card, GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { currency, formatNumber, voteChoiceLabel } from "@/lib/utils";
import { VoteForm } from "@/components/voting/vote-form";
import { StatusPill } from "@/components/ui/status-pill";

export default function WorkspaceClient() {
  const { user } = useAuth();
  const [pendingJointAllocationByProposalId, setPendingJointAllocationByProposalId] = useState<
    Record<string, number>
  >({});
  const [voteDialogProposalId, setVoteDialogProposalId] = useState<string | null>(null);

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
  const pendingJointTotal = workspace.actionItems
    .filter((item) => item.proposalType === "joint")
    .reduce(
      (sum, item) => sum + (pendingJointAllocationByProposalId[item.proposalId] ?? 0),
      0
    );
  const totalIndividualAllocated =
    workspace.personalBudget.jointAllocated +
    workspace.personalBudget.discretionaryAllocated +
    pendingJointTotal;
  const totalIndividualTarget = workspace.personalBudget.jointTarget + workspace.personalBudget.discretionaryCap;

  const budgetSidebar = (
    <Card className="gap-4 p-4">
      <CardLabel>{isManager ? "Your Budget Access" : "Your Individual Budget"}</CardLabel>
      {isManager ? (
        <p className="text-sm text-muted-foreground">
          Managers do not have an individual budget. Joint proposals are still available.
        </p>
      ) : (
        <div className="grid gap-3">
          <PersonalBudgetBars
            title="Total Individual Budget Tracker"
            allocated={totalIndividualAllocated}
            total={totalIndividualTarget}
          />
          <PersonalBudgetBars
            title="Joint Budget Tracker"
            allocated={workspace.personalBudget.jointAllocated + pendingJointTotal}
            total={workspace.personalBudget.jointTarget}
          />
          <PersonalBudgetBars
            title="Discretionary Budget Tracker"
            allocated={workspace.personalBudget.discretionaryAllocated}
            total={workspace.personalBudget.discretionaryCap}
          />
        </div>
      )}
    </Card>
  );

  const voteDialogItem =
    voteDialogProposalId != null
      ? workspace.actionItems.find((i) => i.proposalId === voteDialogProposalId)
      : null;

  return (
    <div className="page-stack pb-4">
      <Dialog
        open={voteDialogProposalId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVoteDialogProposalId(null);
            if (voteDialogProposalId) {
              setPendingJointAllocationByProposalId((prev) => {
                const next = { ...prev };
                delete next[voteDialogProposalId];
                return next;
              });
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={true}>
          {voteDialogItem ? (
            <>
              <DialogHeader>
                <DialogTitle>Cast vote: {voteDialogItem.title}</DialogTitle>
              </DialogHeader>
              <VoteForm
                proposalId={voteDialogItem.proposalId}
                proposalType={voteDialogItem.proposalType}
                proposedAmount={voteDialogItem.proposedAmount}
                totalRequiredVotes={voteDialogItem.totalRequiredVotes}
                onSuccess={() => {
                  setPendingJointAllocationByProposalId((prev) => {
                    const next = { ...prev };
                    delete next[voteDialogItem.proposalId];
                    return next;
                  });
                  setVoteDialogProposalId(null);
                  void workspaceQuery.mutate();
                  mutateAllFoundation();
                }}
                onAllocationChange={
                  voteDialogItem.proposalType === "joint"
                    ? (amount) =>
                        setPendingJointAllocationByProposalId((prev) => ({
                          ...prev,
                          [voteDialogItem.proposalId]: amount
                        }))
                    : undefined
                }
                maxJointAllocation={
                  voteDialogItem.proposalType === "joint" && !isManager
                    ? workspace.personalBudget.jointRemaining +
                      workspace.personalBudget.discretionaryRemaining
                    : undefined
                }
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-3">
          <GlassCard className="rounded-3xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardLabel>My Workspace</CardLabel>
                <CardValue>{workspace.user.name}</CardValue>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {isManager
                    ? "Track action items, submitted proposals, and voting history. Manager profiles do not have individual budgets."
                    : "Track your joint/discretionary balances, action items, and personal voting history."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatNumber(workspace.actionItems.length)} action item(s)</span>
                  <span className="hidden text-border sm:inline">|</span>
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

          <div className="lg:hidden">{budgetSidebar}</div>

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

            <div className="space-y-4">
              {workspace.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vote-required items right now.</p>
              ) : (
                workspace.actionItems.map((item) => {
                  if (!user) {
                    return null;
                  }

                  return (
                    <article
                      key={item.proposalId}
                      className={`rounded-xl border border-t-2 bg-background p-4 shadow-sm ${
                        item.proposalType === "joint"
                          ? "border-t-indigo-400 dark:border-t-indigo-500"
                          : "border-t-amber-400 dark:border-t-amber-500"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">{item.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <StatusPill status={item.status} />
                      </div>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {currency(item.proposedAmount)}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          · {item.voteProgressLabel}
                        </span>
                      </p>
                      <Button
                        className="mt-3 w-full sm:w-auto"
                        onClick={() => setVoteDialogProposalId(item.proposalId)}
                      >
                        <Vote className="h-4 w-4" /> Enter vote & amount
                      </Button>
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
                    className="rounded-xl border border-border p-2 transition-colors hover:bg-muted/60"
                  >
                    <p className="text-sm font-medium">{vote.proposalTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {voteChoiceLabel(vote.choice)} | {currency(vote.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(vote.at).toLocaleDateString()}</p>
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
                  <p className="text-sm text-muted-foreground">No submitted gifts yet.</p>
                ) : (
                  workspace.submittedGifts.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="rounded-xl border border-border p-2 transition-colors hover:bg-muted/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{proposal.title}</p>
                        <StatusPill status={proposal.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Budget Year: {proposal.budgetYear}</p>
                      <p className="text-xs text-muted-foreground">Amount: {currency(proposal.proposedAmount)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{proposal.description}</p>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </section>
        </div>

        <div className="hidden lg:block">
          <div className="lg:sticky lg:top-6">{budgetSidebar}</div>
        </div>
      </div>
    </div>
  );
}
