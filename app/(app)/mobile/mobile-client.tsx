"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { ListChecks, RefreshCw, Vote, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { VoteForm } from "@/components/voting/vote-form";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency, titleCase } from "@/lib/utils";

const ACTION_ITEMS_PREVIEW_LIMIT = 2;

export default function MobileFocusClient() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => setMounted(true), []);
  const workspaceQuery = useSWR<WorkspaceSnapshot>(user ? "/api/workspace" : null, {
    refreshInterval: 30_000
  });
  const deepLinkTarget = useMemo(() => {
    const value = searchParams.get("next")?.trim() ?? "";
    if (!value.startsWith("/") || value.startsWith("//")) {
      return null;
    }
    return value;
  }, [searchParams]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [voteDialogProposalId, setVoteDialogProposalId] = useState<string | null>(null);
  const [pendingJointAllocationByProposalId, setPendingJointAllocationByProposalId] = useState<
    Record<string, number>
  >({});

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void workspaceQuery.mutate().finally(() => {
      setTimeout(() => setIsRefreshing(false), 600);
    });
  }, [workspaceQuery]);

  if (workspaceQuery.isLoading) {
    return (
      <div className="page-stack pb-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (workspaceQuery.error || !workspaceQuery.data) {
    return (
      <div className="page-stack pb-4">
        <GlassCard className="p-3">
          <p className="text-sm text-rose-600">
            Could not load the focus view
            {workspaceQuery.error ? `: ${workspaceQuery.error.message}` : "."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void workspaceQuery.mutate()}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
            >
              View Full Details
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const workspace = workspaceQuery.data;
  const isManager = workspace.user.role === "manager";
  const visibleActionItems = workspace.actionItems.slice(0, ACTION_ITEMS_PREVIEW_LIMIT);
  const remainingActionItems = Math.max(0, workspace.actionItems.length - visibleActionItems.length);
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

  const voteDialogItem =
    voteDialogProposalId != null
      ? workspace.actionItems.find((i) => i.proposalId === voteDialogProposalId)
      : null;

  return (
    <div className="page-stack pb-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s Focus</p>
        <div className="flex items-center gap-1.5">
          {mounted && (
            <ThemeToggle className="h-8 w-8 shrink-0 rounded-lg border bg-card sm:h-9 sm:w-9" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleRefresh();
            }}
            disabled={isRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors active:bg-muted hover:text-foreground focus:outline-none"
            aria-label="Refresh data"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {deepLinkTarget ? (
        <GlassCard className="p-3">
          <p className="text-xs text-muted-foreground">Continue to the required action from your email.</p>
          <Link
            href={deepLinkTarget}
            className="mt-2 inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Continue to required action
          </Link>
        </GlassCard>
      ) : null}

      <GlassCard className="p-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Wallet className="h-4 w-4" />
          </span>
          <CardLabel>Personal Budget</CardLabel>
        </div>
        {isManager ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Managers do not have an individual budget. Manager profiles can submit joint proposals only.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              {
                label: "Total",
                remaining: Math.max(0, totalIndividualTarget - totalIndividualAllocated),
                allocated: totalIndividualAllocated,
                total: totalIndividualTarget
              },
              {
                label: "Joint",
                remaining: Math.max(
                  0,
                  workspace.personalBudget.jointTarget -
                    (workspace.personalBudget.jointAllocated + pendingJointTotal)
                ),
                allocated: workspace.personalBudget.jointAllocated + pendingJointTotal,
                total: workspace.personalBudget.jointTarget
              },
              {
                label: "Discretionary",
                remaining: workspace.personalBudget.discretionaryRemaining,
                allocated: workspace.personalBudget.discretionaryAllocated,
                total: workspace.personalBudget.discretionaryCap
              }
            ].map(({ label, remaining, allocated, total }) => {
              const ratio = total === 0 ? 0 : Math.min(100, Math.round((allocated / total) * 100));
              return (
                <div key={label} className="rounded-xl border border-border/80 bg-muted/30 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {currency(remaining)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">remaining of your budget of {currency(total)}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-accent"
                      style={{ width: `${ratio}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <ListChecks className="h-4 w-4" />
              </span>
              <CardLabel>Outstanding Action Items</CardLabel>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {workspace.actionItems.length === 0
                ? "No action items waiting right now."
                : `${workspace.actionItems.length} item${workspace.actionItems.length === 1 ? "" : "s"} waiting for your response.`}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            {workspace.actionItems.length} open
          </span>
        </div>

        <div className="space-y-4">
          {visibleActionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            visibleActionItems.map((item) => {
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
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {currency(item.proposedAmount)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground dark:text-muted-foreground">Type</span>
                      <p className="font-medium text-foreground">
                        {titleCase(item.proposalType)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground dark:text-muted-foreground">Progress</span>
                      <p className="font-medium text-foreground">
                        {item.voteProgressLabel}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => setVoteDialogProposalId(item.proposalId)}
                  >
                    <Vote className="h-4 w-4" /> Enter vote & amount
                  </Button>
                </article>
              );
            })
          )}
        </div>

        {remainingActionItems > 0 ? (
          <Link
            href="/workspace"
            className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-accent"
          >
            View {remainingActionItems} more action item{remainingActionItems === 1 ? "" : "s"}
          </Link>
        ) : null}
      </GlassCard>

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
    </div>
  );
}
