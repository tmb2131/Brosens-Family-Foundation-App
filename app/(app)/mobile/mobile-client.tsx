"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { ChevronDown, ListChecks, LogOut, Plus, RefreshCw, Vote, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  ResponsiveModal,
  ResponsiveModalContent,
} from "@/components/ui/responsive-modal";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { VoteForm, VoteFormFooterButton, VoteFormProvider } from "@/components/voting/vote-form";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency, titleCase } from "@/lib/utils";

export default function MobileFocusClient() {
  const { user, signOut } = useAuth();
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
  const [isVoteSaving, setIsVoteSaving] = useState(false);
  const [pendingJointAllocationByProposalId, setPendingJointAllocationByProposalId] = useState<
    Record<string, number>
  >({});
  const [voteModalBudgetExpanded, setVoteModalBudgetExpanded] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void workspaceQuery.mutate().finally(() => {
      setTimeout(() => setIsRefreshing(false), 600);
    });
  }, [workspaceQuery]);

  const PULL_THRESHOLD = 60;
  const touchStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const [pullVisualDistance, setPullVisualDistance] = useState(0);

  const handlePullTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollEl = document.querySelector<HTMLElement>("[data-main-scroll]");
    const scrollTop = scrollEl ? scrollEl.scrollTop : window.scrollY;
    if (scrollTop === 0) {
      touchStartYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handlePullTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    if (dy > 0) {
      pullDistanceRef.current = dy;
      setPullVisualDistance(Math.min(dy, PULL_THRESHOLD * 1.5));
    } else {
      touchStartYRef.current = null;
      pullDistanceRef.current = 0;
      setPullVisualDistance(0);
    }
  }, []);

  const handlePullTouchEnd = useCallback(() => {
    const shouldRefresh = pullDistanceRef.current >= PULL_THRESHOLD && !isRefreshing;
    touchStartYRef.current = null;
    pullDistanceRef.current = 0;
    setPullVisualDistance(0);
    if (shouldRefresh) handleRefresh();
  }, [isRefreshing, handleRefresh]);

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
  const pendingJointTotal = workspace.actionItems
    .filter((item) => item.proposalType === "joint")
    .reduce(
      (sum, item) => sum + (pendingJointAllocationByProposalId[item.proposalId] ?? 0),
      0
    );
  const jointRemaining = workspace.personalBudget.jointRemaining;
  const pendingJointPortion = Math.min(pendingJointTotal, jointRemaining);
  const pendingDiscretionaryPortion = Math.max(0, pendingJointTotal - jointRemaining);
  const totalIndividualAllocated =
    workspace.personalBudget.jointAllocated +
    workspace.personalBudget.discretionaryAllocated +
    pendingJointTotal;
  const totalIndividualTarget = workspace.personalBudget.jointTarget + workspace.personalBudget.discretionaryCap;
  const totalBudgetRemaining =
    workspace.personalBudget.jointRemaining + workspace.personalBudget.discretionaryRemaining;
  const voteDialogItem =
    voteDialogProposalId != null
      ? workspace.actionItems.find((i) => i.proposalId === voteDialogProposalId)
      : null;

  return (
    <div
      className="page-stack pb-4"
      onTouchStart={handlePullTouchStart}
      onTouchMove={handlePullTouchMove}
      onTouchEnd={handlePullTouchEnd}
    >
      {(pullVisualDistance > 0 || isRefreshing) && (
        <div
          aria-hidden
          className="flex items-center justify-center overflow-hidden"
          style={{ height: `${pullVisualDistance > 0 ? Math.min(pullVisualDistance, PULL_THRESHOLD) : PULL_THRESHOLD}px` }}
        >
          <RefreshCw
            className={`h-5 w-5 ${isRefreshing ? "animate-spin text-accent" : pullVisualDistance >= PULL_THRESHOLD ? "text-accent" : "text-muted-foreground"}`}
            style={isRefreshing ? undefined : {
              transform: `rotate(${Math.min((pullVisualDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
              transition: "none"
            }}
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s Focus</p>
        <div className="flex items-center gap-1.5">
          {mounted && (
            <>
              <ThemeToggle className="h-10 w-10 shrink-0 rounded-lg border bg-card sm:h-9 sm:w-9" />
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card hover:bg-muted focus:outline-none sm:h-9 sm:w-9"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </>
          )}
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
            <PersonalBudgetBars
              title="Total"
              allocated={totalIndividualAllocated - pendingJointTotal}
              total={totalIndividualTarget}
              pendingAllocation={pendingJointTotal}
              compact
            />
            <PersonalBudgetBars
              title="Joint"
              allocated={workspace.personalBudget.jointAllocated}
              total={workspace.personalBudget.jointTarget}
              pendingAllocation={pendingJointPortion}
              compact
            />
            <PersonalBudgetBars
              title="Discretionary"
              allocated={workspace.personalBudget.discretionaryAllocated}
              total={workspace.personalBudget.discretionaryCap}
              pendingAllocation={pendingDiscretionaryPortion}
              compact
            />
            <p
              className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
              role="img"
              aria-label="Green is allocated, blue is your allocation"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 shrink-0 rounded-full bg-accent" aria-hidden />
                Allocated
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: "rgb(var(--proposal-cta))" }}
                  aria-hidden
                />
                Your input
              </span>
            </p>
          </div>
        )}
      </GlassCard>

      {(() => {
        const noSubmissionThisYear = !workspace.submittedGifts.some(
          (g) => g.budgetYear === workspace.currentBudgetYear
        );
        const totalBudgetRemaining =
          workspace.personalBudget.jointRemaining +
          workspace.personalBudget.discretionaryRemaining;
        const hasBudgetLeft = !isManager && totalBudgetRemaining > 0;
        if (!noSubmissionThisYear && !hasBudgetLeft) return null;
        const parts: string[] = [];
        if (noSubmissionThisYear) parts.push("You haven't submitted a proposal this year.");
        if (hasBudgetLeft) {
          parts.push(`You have ${currency(totalBudgetRemaining)} budget left.`);
        }
        return (
          <GlassCard className="p-3">
            <p className="text-xs text-muted-foreground">{parts.join(" ")}</p>
          </GlassCard>
        );
      })()}

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
          {workspace.actionItems.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              {workspace.actionItems.length} open
            </span>
          )}
        </div>

        <div className="space-y-4">
          {workspace.actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            workspace.actionItems.map((item) => {
              if (!user) {
                return null;
              }

              return (
                <article
                  key={item.proposalId}
                  className={`content-auto rounded-xl border border-t-2 bg-background p-4 shadow-sm ${
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
      </GlassCard>

      <ResponsiveModal
        open={voteDialogProposalId !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (isVoteSaving) return;
            setVoteDialogProposalId(null);
            setVoteModalBudgetExpanded(false);
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
        {voteDialogItem ? (
          <VoteFormProvider
            variant="mobile"
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
                      [voteDialogItem.proposalId]: amount,
                    }))
                : undefined
            }
            maxJointAllocation={
              voteDialogItem.proposalType === "joint" && !isManager
                ? workspace.personalBudget.jointRemaining +
                  workspace.personalBudget.discretionaryRemaining
                : undefined
            }
            onSavingChange={setIsVoteSaving}
          >
            <ResponsiveModalContent
              dialogClassName="sm:max-w-md"
              showCloseButton={true}
              onInteractOutside={(e) => {
                if (isVoteSaving) e.preventDefault();
              }}
              footer={<VoteFormFooterButton />}
            >
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-lg font-bold">{voteDialogItem.title}</DialogTitle>
                  <Badge
                    className={
                      voteDialogItem.proposalType === "joint"
                        ? "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }
                  >
                    {titleCase(voteDialogItem.proposalType)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  Proposed: {currency(voteDialogItem.proposedAmount)}
                </p>
              </DialogHeader>
              {voteDialogItem.proposalType === "joint" && !isManager ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-foreground">
                    You have {currency(totalBudgetRemaining)} remaining (joint + discretionary).
                  </p>
                  <button
                    type="button"
                    onClick={() => setVoteModalBudgetExpanded((prev) => !prev)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    aria-expanded={voteModalBudgetExpanded}
                  >
                    Your budget
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${voteModalBudgetExpanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {voteModalBudgetExpanded ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <PersonalBudgetBars
                        title="Total"
                        allocated={totalIndividualAllocated - pendingJointTotal}
                        total={totalIndividualTarget}
                        pendingAllocation={pendingJointTotal}
                        compact
                      />
                      <PersonalBudgetBars
                        title="Joint"
                        allocated={workspace.personalBudget.jointAllocated}
                        total={workspace.personalBudget.jointTarget}
                        pendingAllocation={pendingJointPortion}
                        compact
                      />
                      <PersonalBudgetBars
                        title="Discretionary"
                        allocated={workspace.personalBudget.discretionaryAllocated}
                        total={workspace.personalBudget.discretionaryCap}
                        pendingAllocation={pendingDiscretionaryPortion}
                        compact
                      />
                      <p
                        className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
                        role="img"
                        aria-label="Green is allocated, blue is your allocation"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-4 shrink-0 rounded-full bg-accent" aria-hidden />
                          Allocated
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-4 shrink-0 rounded-full"
                            style={{ backgroundColor: "rgb(var(--proposal-cta))" }}
                            aria-hidden
                          />
                          Your input
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className={voteDialogItem.proposalType === "joint" && !isManager ? "mt-3" : undefined}>
                <VoteForm
                  proposalId={voteDialogItem.proposalId}
                  proposalType={voteDialogItem.proposalType}
                  proposedAmount={voteDialogItem.proposedAmount}
                  totalRequiredVotes={voteDialogItem.totalRequiredVotes}
                  onSuccess={() => {}}
                  onAllocationChange={undefined}
                  maxJointAllocation={undefined}
                  onSavingChange={() => {}}
                />
              </div>
            </ResponsiveModalContent>
          </VoteFormProvider>
        ) : (
          <ResponsiveModalContent
            dialogClassName="sm:max-w-md"
            showCloseButton={true}
            onInteractOutside={(e) => {
              if (isVoteSaving) e.preventDefault();
            }}
          >
            {null}
          </ResponsiveModalContent>
        )}
      </ResponsiveModal>
    </div>
  );
}
