"use client";

import { useCallback, useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import useSWR from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { CheckCircle2, Gift, History, ListChecks, Plus, RefreshCw, Vote, Wallet, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ResponsiveModal, ResponsiveModalContent, useIsMobile } from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";
import { WorkspaceSnapshot } from "@/lib/types";
import { Card, GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { charityNavigatorRating, currency, formatNumber, titleCase, voteChoiceLabel } from "@/lib/utils";
import { VoteForm } from "@/components/voting/vote-form";
import { StatusPill } from "@/components/ui/status-pill";
import { useWorkspaceWalkthrough } from "@/components/workspace-walkthrough-context";

const WALKTHROUGH_STEPS: Array<{
  target: string;
  targetFallback?: string;
  title: string;
  body: string;
}> = [
  {
    target: "workspace-intro",
    title: "My Workspace",
    body:
      "This is your personal workspace. Here you can see your budget summary, action items that need your vote, and your submitted proposals. Use New Proposal to submit a new grant."
  },
  {
    target: "budget-card",
    targetFallback: "budget",
    title: "Your budget",
    body:
      "View your remaining individual budget here, split into Joint and Discretionary. Green shows what's already been allocated."
  },
  {
    target: "action-items",
    title: "Action items",
    body:
      "Proposals that still need your vote appear here. Click Enter vote & amount to cast your vote and, for joint proposals, assign your allocation from your budget."
  },
  {
    target: "personal-history",
    title: "Personal history",
    body: "Your past votes are listed here so you can see what you’ve supported and how much you allocated."
  },
  {
    target: "submitted-gifts",
    title: "My submitted gifts",
    body: "Proposals you’ve submitted appear here. You can track their status as they move through the process."
  }
];

export default function WorkspaceClient() {
  const { user } = useAuth();
  const [pendingJointAllocationByProposalId, setPendingJointAllocationByProposalId] = useState<
    Record<string, number>
  >({});
  const [voteDialogProposalId, setVoteDialogProposalId] = useState<string | null>(null);
  const budgetSidebarRef = useRef<HTMLDivElement>(null);
  const budgetCardRef = useRef<HTMLDivElement>(null);
  const [overlayCutoutRect, setOverlayCutoutRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const { registerStartWalkthrough } = useWorkspaceWalkthrough();
  const isSmallScreen = useIsMobile();

  useEffect(() => {
    return registerStartWalkthrough(() => {
      setWalkthroughStep(0);
      setWalkthroughOpen(true);
    });
  }, [registerStartWalkthrough]);

  useEffect(() => {
    if (voteDialogProposalId == null) return;
    if (!budgetSidebarRef.current || !window.matchMedia("(min-width: 1024px)").matches) return;
    const el = budgetSidebarRef.current;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [voteDialogProposalId]);

  useLayoutEffect(() => {
    if (voteDialogProposalId == null || !window.matchMedia("(min-width: 1024px)").matches) {
      setOverlayCutoutRect(null);
      return;
    }
    const measure = () => {
      const el = budgetCardRef.current;
      if (!el) {
        setOverlayCutoutRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        setOverlayCutoutRect(null);
        return;
      }
      setOverlayCutoutRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [voteDialogProposalId]);

  const closeWalkthrough = useCallback(() => {
    setWalkthroughOpen(false);
    setWalkthroughStep(0);
    setSpotlightRect(null);
  }, []);

  const [spotlightRect, setSpotlightRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  function getTargetElementForStep(stepIndex: number): HTMLElement | null {
    const step = WALKTHROUGH_STEPS[stepIndex];
    if (!step) return null;
    const primary = document.querySelector<HTMLElement>(`[data-walkthrough="${step.target}"]`);
    const fallback = step.targetFallback
      ? document.querySelector<HTMLElement>(`[data-walkthrough="${step.targetFallback}"]`)
      : null;
    const hasSize = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    if (primary && hasSize(primary)) return primary;
    if (fallback && hasSize(fallback)) return fallback;
    return primary ?? fallback ?? null;
  }

  const measureAndSetRect = useCallback((stepIndex: number) => {
    const el = getTargetElementForStep(stepIndex);
    if (el) {
      const r = el.getBoundingClientRect();
      setSpotlightRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    } else {
      setSpotlightRect(null);
    }
  }, []);

  useLayoutEffect(() => {
    if (!walkthroughOpen) return;
    const el = getTargetElementForStep(walkthroughStep);
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
    measureAndSetRect(walkthroughStep);
    const t1 = setTimeout(() => measureAndSetRect(walkthroughStep), 50);
    const t2 = setTimeout(() => measureAndSetRect(walkthroughStep), 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [walkthroughOpen, walkthroughStep, measureAndSetRect]);

  useEffect(() => {
    if (!walkthroughOpen) return;
    const handleResize = () => measureAndSetRect(walkthroughStep);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [walkthroughOpen, walkthroughStep, measureAndSetRect]);

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
  const jointRemaining = workspace.personalBudget.jointRemaining;
  const pendingJointPortion = Math.min(pendingJointTotal, jointRemaining);
  const pendingDiscretionaryPortion = Math.max(0, pendingJointTotal - jointRemaining);
  const totalIndividualAllocated =
    workspace.personalBudget.jointAllocated +
    workspace.personalBudget.discretionaryAllocated +
    pendingJointTotal;
  const totalIndividualTarget = workspace.personalBudget.jointTarget + workspace.personalBudget.discretionaryCap;

  const budgetSidebar = (
    <Card className="gap-4 p-4" data-walkthrough="budget-card">
      <CardLabel>{isManager ? "Your Budget Access" : "Your Individual Budget"}</CardLabel>
      {isManager ? (
        <p className="text-sm text-muted-foreground">
          Managers do not have an individual budget. Joint proposals are still available.
        </p>
      ) : (
        <div className="grid gap-3">
          <PersonalBudgetBars
            title="Total Individual Budget"
            allocated={totalIndividualAllocated - pendingJointTotal}
            total={totalIndividualTarget}
            pendingAllocation={pendingJointTotal}
          />
          <PersonalBudgetBars
            title="Joint Budget"
            allocated={workspace.personalBudget.jointAllocated}
            total={workspace.personalBudget.jointTarget}
            pendingAllocation={pendingJointPortion}
          />
          <PersonalBudgetBars
            title="Discretionary Budget"
            allocated={workspace.personalBudget.discretionaryAllocated}
            total={workspace.personalBudget.discretionaryCap}
            pendingAllocation={pendingDiscretionaryPortion}
          />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" role="img" aria-label="Green is allocated, blue is your allocation">
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
    </Card>
  );

  const voteDialogItem =
    voteDialogProposalId != null
      ? workspace.actionItems.find((i) => i.proposalId === voteDialogProposalId)
      : null;

  return (
    <div className="page-stack pb-4">
      <ResponsiveModal
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
        {voteDialogItem ? (
          <ResponsiveModalContent
            aria-labelledby="vote-dialog-title"
            dialogClassName={cn(
              "rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overflow-x-hidden",
              !isSmallScreen ? "sm:max-w-4xl sm:-ml-[100px]" : "sm:max-w-md"
            )}
            showCloseButton={false}
            overlayCutoutRect={overlayCutoutRect}
            footer={
              isSmallScreen ? (
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
              ) : null
            }
          >
            <div className={cn(!isSmallScreen && "flex items-start gap-6")}>
              <div className={cn(!isSmallScreen && "flex-1 min-w-0")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle id="vote-dialog-title" className="text-lg font-bold">
                        {voteDialogItem.title}
                      </DialogTitle>
                      <Badge className={voteDialogItem.proposalType === "joint"
                        ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
                        : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
                      }>
                        {titleCase(voteDialogItem.proposalType)}
                      </Badge>
                      <StatusPill status={voteDialogItem.status} />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setVoteDialogProposalId(null);
                      if (voteDialogProposalId) {
                        setPendingJointAllocationByProposalId((prev) => {
                          const next = { ...prev };
                          delete next[voteDialogProposalId];
                          return next;
                        });
                      }
                    }}
                    aria-label="Close proposal details"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-muted/60 p-4 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</dt>
                    <dd className="mt-1.5 text-lg font-bold text-foreground">
                      {voteDialogItem.progress.masked && voteDialogItem.proposalType !== "joint" && voteDialogItem.proposalType !== "discretionary"
                        ? "Blind until your vote is submitted"
                        : (voteDialogItem.proposalType === "joint" || voteDialogItem.proposalType === "discretionary") && voteDialogItem.status === "to_review"
                        ? currency(voteDialogItem.proposedAmount)
                        : currency(voteDialogItem.progress.computedFinalAmount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date Sent</dt>
                    <dd className="mt-1.5 font-semibold text-foreground">
                      {voteDialogItem.sentAt
                        ? new Date(voteDialogItem.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</dt>
                    <dd className="mt-1.5 whitespace-pre-wrap font-semibold text-foreground">
                      {voteDialogItem.description?.trim() || "—"}
                    </dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Organization Website</dt>
                    <dd className="mt-1.5 text-foreground">
                      {voteDialogItem.organizationWebsite ? (
                        <a
                          href={voteDialogItem.organizationWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                        >
                          {voteDialogItem.organizationWebsite}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Charity Navigator URL</dt>
                    <dd className="mt-1.5 text-foreground">
                      {voteDialogItem.charityNavigatorUrl ? (
                        <>
                          <a
                            href={voteDialogItem.charityNavigatorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                          >
                            {voteDialogItem.charityNavigatorUrl}
                          </a>
                          {voteDialogItem.charityNavigatorScore != null ? (
                            <div className="mt-2 rounded-lg border border-border/70 bg-muted/50 p-2.5 text-xs">
                              <p className="font-medium text-foreground">
                                This charity&apos;s score is {Math.round(voteDialogItem.charityNavigatorScore)}%, earning it a{" "}
                                {charityNavigatorRating(voteDialogItem.charityNavigatorScore).starLabel} rating.
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                {charityNavigatorRating(voteDialogItem.charityNavigatorScore).meaning}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-muted-foreground">Score not yet available.</p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Add the Charity Navigator URL to autopopulate the charity&apos;s score.
                        </span>
                      )}
                    </dd>
                  </div>
                  {voteDialogItem.notes?.trim() ? (
                    <div className="md:col-span-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</dt>
                      <dd className="mt-1.5 whitespace-pre-wrap font-semibold text-foreground">{voteDialogItem.notes.trim()}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {!isSmallScreen ? (
                <div className="w-80 shrink-0 border-l pl-6 pt-1">
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
                    className="border-t-0 pt-0"
                  />
                </div>
              ) : null}
            </div>
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>

      {walkthroughOpen &&
        spotlightRect &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[45] pointer-events-none" aria-hidden>
              <div
                className="bg-transparent"
                style={{
                  position: "fixed",
                  left: spotlightRect.left,
                  top: spotlightRect.top,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                  boxShadow: "0 0 0 9999px hsl(0 0% 0% / 0.45)",
                  outline: "2px solid hsl(var(--accent))",
                  outlineOffset: 4,
                  borderRadius: "0.75rem"
                }}
              />
            </div>
            <div className="fixed inset-0 z-[45] pointer-events-auto" aria-hidden>
              <div
                className="pointer-events-none"
                style={{
                  position: "fixed",
                  left: spotlightRect.left,
                  top: spotlightRect.top,
                  width: spotlightRect.width,
                  height: spotlightRect.height
                }}
              />
            </div>
          </>,
          document.body
        )}

      <Dialog
        open={walkthroughOpen}
        onOpenChange={(open) => {
          if (!open) closeWalkthrough();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {(() => {
            const step = WALKTHROUGH_STEPS[walkthroughStep];
            if (!step) return null;
            const isFirst = walkthroughStep === 0;
            const isLast = walkthroughStep === WALKTHROUGH_STEPS.length - 1;
            return (
              <>
                <DialogHeader>
                  <p className="text-xs font-medium text-muted-foreground" aria-hidden>
                    Step {walkthroughStep + 1} of {WALKTHROUGH_STEPS.length}
                  </p>
                  <DialogTitle id="walkthrough-title">{step.title}</DialogTitle>
                  <DialogDescription id="walkthrough-description" className="mt-1 text-left">
                    {step.body}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 flex-row flex-wrap gap-2 sm:justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="order-last sm:order-first text-muted-foreground"
                    onClick={closeWalkthrough}
                  >
                    Skip tour
                  </Button>
                  <div className="flex gap-2">
                    {!isFirst && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWalkthroughStep((s) => s - 1)}
                      >
                        Back
                      </Button>
                    )}
                    {isLast ? (
                      <Button size="sm" onClick={closeWalkthrough}>
                        Finish
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setWalkthroughStep((s) => s + 1)}>
                        Next
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-3">
          <GlassCard className="rounded-3xl" data-walkthrough="workspace-intro">
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
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {workspace.actionItems.length > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      {formatNumber(workspace.actionItems.length)} action item{workspace.actionItems.length !== 1 ? "s" : ""} pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      All caught up
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">&middot; {formatNumber(workspace.submittedGifts.length)} submitted proposal{workspace.submittedGifts.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <Button variant="proposal" asChild className="sm:min-h-11 sm:px-4 sm:text-sm">
                <Link href="/proposals/new" title="New Proposal (⇧N)">
                  <Plus className="h-4 w-4" /> New Proposal
                </Link>
              </Button>
            </div>
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
                <p className="mt-2 text-xs text-muted-foreground">{parts.join(" ")}</p>
              );
            })()}
          </GlassCard>

          <GlassCard className="p-3 lg:hidden" data-walkthrough="budget">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Wallet className="h-4 w-4" />
              </span>
              <CardLabel>Personal Budget</CardLabel>
            </div>
            {isManager ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Managers do not have an individual budget. Joint proposals are still available.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <PersonalBudgetBars
                  title={`Total${totalIndividualTarget > 0 ? ` · ${Math.round(((totalIndividualAllocated) / totalIndividualTarget) * 100)}% committed` : ""}`}
                  allocated={totalIndividualAllocated - pendingJointTotal}
                  total={totalIndividualTarget}
                  pendingAllocation={pendingJointTotal}
                  compact
                />
                <PersonalBudgetBars
                  title={`Joint${workspace.personalBudget.jointTarget > 0 ? ` · ${Math.round(((workspace.personalBudget.jointAllocated + pendingJointPortion) / workspace.personalBudget.jointTarget) * 100)}% committed` : ""}`}
                  allocated={workspace.personalBudget.jointAllocated}
                  total={workspace.personalBudget.jointTarget}
                  pendingAllocation={pendingJointPortion}
                  compact
                />
                <PersonalBudgetBars
                  title={`Discr.${workspace.personalBudget.discretionaryCap > 0 ? ` · ${Math.round(((workspace.personalBudget.discretionaryAllocated + pendingDiscretionaryPortion) / workspace.personalBudget.discretionaryCap) * 100)}% committed` : ""}`}
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

          <GlassCard data-walkthrough="action-items">
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
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">You&apos;re all caught up!</p>
                  <p className="text-xs text-muted-foreground">No proposals need your vote right now.</p>
                </div>
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
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-sm font-semibold">{item.title}</h3>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                item.proposalType === "joint"
                                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              }`}
                            >
                              {item.proposalType === "joint" ? "Joint" : "Discretionary"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusPill status={item.status} />
                          <span className="text-xs font-medium text-muted-foreground">
                            {item.voteProgressLabel}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {currency(item.proposedAmount)}
                        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                          proposed donation
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
            <GlassCard data-walkthrough="personal-history">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  <History className="h-4 w-4" />
                </span>
                <CardLabel>Personal History</CardLabel>
              </div>
              <div className="mt-3 space-y-2">
                {workspace.voteHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No votes recorded yet.</p>
                ) : workspace.voteHistory.map((vote) => (
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

            <GlassCard data-walkthrough="submitted-gifts">
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{proposal.title}</p>
                        <StatusPill status={proposal.status} />
                      </div>
                      <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
                        {currency(proposal.proposedAmount)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">· {proposal.budgetYear}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{proposal.description}</p>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </section>
        </div>

        <div ref={budgetSidebarRef} className="hidden lg:block">
          <div ref={budgetCardRef} className="lg:sticky lg:top-6">
            {budgetSidebar}
          </div>
        </div>
      </div>
    </div>
  );
}
