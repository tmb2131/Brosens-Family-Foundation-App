"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { PRELOADED_SWR_CONFIG } from "@/lib/swr-helpers";
import { RefreshCw, Wallet } from "lucide-react";
import { useMobileWalkthrough } from "@/components/mobile-walkthrough-context";
import { useWalkthrough, type WalkthroughStep } from "@/lib/hooks/use-walkthrough";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard, CardLabel } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency } from "@/lib/utils";
import { RevalidatingDot } from "@/components/ui/revalidating-dot";
import { MobileGreetingHeader } from "./mobile-greeting-header";
import { MobileProfileSheet } from "./mobile-profile-sheet";
import { MobileNudgeCard } from "./mobile-nudge-card";
import { MobileActionItems } from "./mobile-action-items";
import { MobileVoteModal } from "./mobile-vote-modal";
import { usePagePerf } from "@/lib/perf-logger-client";

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    target: "mobile-header",
    title: "Your Home",
    body: "This is your personal mobile home. Tap your initials in the top-right to access your profile, theme toggle, and walkthrough guide.",
  },
  {
    target: "mobile-budget",
    title: "Personal Budget",
    body: "View your remaining individual budget here, split into Joint and Discretionary. Green shows what's already been allocated.",
  },
  {
    target: "mobile-nudge",
    title: "Quick Tips",
    body: "Helpful reminders appear here — like when you haven't submitted a proposal this year or still have budget remaining.",
  },
  {
    target: "mobile-action-items",
    title: "Action Items",
    body: "Proposals that still need your vote appear here. Tap Enter vote to cast your vote and, for joint proposals, assign your allocation.",
  },
];

interface MobileFocusClientProps {
  initialWorkspace: WorkspaceSnapshot;
}

export default function MobileFocusClient({ initialWorkspace }: MobileFocusClientProps) {
  const searchParams = useSearchParams();

  const workspaceQuery = useSWR<WorkspaceSnapshot>("/api/workspace", {
    refreshInterval: 30_000,
    fallbackData: initialWorkspace,
    ...PRELOADED_SWR_CONFIG,
  });

  usePagePerf("/mobile", !workspaceQuery.isLoading, {
    isLoading: workspaceQuery.isLoading,
    hasData: workspaceQuery.data !== undefined,
    error: workspaceQuery.error?.message ?? null,
  });
  const deepLinkTarget = useMemo(() => {
    const value = searchParams.get("next")?.trim() ?? "";
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    return value;
  }, [searchParams]);

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [voteDialogProposalId, setVoteDialogProposalId] = useState<string | null>(null);
  const [isVoteSaving, setIsVoteSaving] = useState(false);
  const [pendingJointAllocationByProposalId, setPendingJointAllocationByProposalId] = useState<
    Record<string, number>
  >({});

  // ── Walkthrough ──────────────────────────────────────────────────
  const { registerStartWalkthrough } = useMobileWalkthrough();
  const mobileWalkthroughOnClose = useCallback(() => {
    try { localStorage.setItem("mobile-walkthrough-seen", "1"); } catch { /* noop */ }
  }, []);
  const walkthrough = useWalkthrough({ steps: WALKTHROUGH_STEPS, onClose: mobileWalkthroughOnClose });
  const openWalkthrough = walkthrough.open;

  useEffect(() => {
    return registerStartWalkthrough(openWalkthrough);
  }, [registerStartWalkthrough, openWalkthrough]);

  // Auto-show walkthrough on first visit
  useEffect(() => {
    if (!workspaceQuery.data) return;
    try {
      if (!localStorage.getItem("mobile-walkthrough-seen")) {
        openWalkthrough();
      }
    } catch { /* noop */ }
  }, [workspaceQuery.data, openWalkthrough]);

  // ── Loading / Error ──────────────────────────────────────────────
  if (!workspaceQuery.data) {
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
        <GlassCard className="p-3" role="alert">
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

  // ── Derived values ───────────────────────────────────────────────
  const workspace = workspaceQuery.data;
  const isManager = workspace.user.role === "manager";
  const pendingJointTotal = workspace.actionItems
    .filter((item) => item.proposalType === "joint")
    .reduce(
      (sum, item) => sum + (pendingJointAllocationByProposalId[item.proposalId] ?? 0),
      0,
    );
  const jointRemaining = workspace.personalBudget.jointRemaining;
  const pendingJointPortion = Math.min(pendingJointTotal, jointRemaining);
  const pendingDiscretionaryPortion = Math.max(0, pendingJointTotal - jointRemaining);
  const totalIndividualAllocated =
    workspace.personalBudget.jointAllocated +
    workspace.personalBudget.discretionaryAllocated +
    pendingJointTotal;
  const totalIndividualTarget =
    workspace.personalBudget.jointTarget + workspace.personalBudget.discretionaryCap;
  const totalBudgetRemaining =
    workspace.personalBudget.jointRemaining + workspace.personalBudget.discretionaryRemaining;

  const noSubmissionThisYear = !workspace.submittedGifts.some(
    (g) => g.budgetYear === workspace.currentBudgetYear,
  );
  const hasBudgetLeft = !isManager && totalBudgetRemaining > 0;

  const voteDialogItem =
    voteDialogProposalId != null
      ? workspace.actionItems.find((i) => i.proposalId === voteDialogProposalId) ?? null
      : null;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="page-stack pb-4">
      <MobileGreetingHeader
        userName={workspace.user.name}
        userEmail={workspace.user.email}
        onAvatarPress={() => setProfileSheetOpen(true)}
      />

      <MobileProfileSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        userName={workspace.user.name}
        userRole={workspace.user.role}
      />

      {deepLinkTarget ? (
        <GlassCard className="p-3">
          <p className="text-xs text-muted-foreground">
            Continue to the required action from your email.
          </p>
          <Link
            href={deepLinkTarget}
            className="mt-2 inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Continue to required action
          </Link>
        </GlassCard>
      ) : null}

      <GlassCard className="p-3" data-walkthrough="mobile-budget">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Wallet className="h-4 w-4" />
          </span>
          <CardLabel>Personal Budget</CardLabel>
          <RevalidatingDot isValidating={workspaceQuery.isValidating} hasData={!!workspaceQuery.data} />
        </div>
        {isManager ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Managers do not have an individual budget. Manager profiles can submit joint proposals
            only.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <PersonalBudgetBars
              title="Total"
              allocated={totalIndividualAllocated - pendingJointTotal}
              total={totalIndividualTarget}
              pendingAllocation={pendingJointTotal}
              compact
              emphasizeBorder
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

      <MobileNudgeCard
        noSubmissionThisYear={noSubmissionThisYear}
        hasBudgetLeft={hasBudgetLeft}
        budgetRemaining={totalBudgetRemaining}
        isManager={isManager}
      />

      <MobileActionItems
        actionItems={workspace.actionItems}
        isManager={isManager}
        hasBudgetLeft={hasBudgetLeft}
        onVote={setVoteDialogProposalId}
      />

      <MobileVoteModal
        voteDialogItem={voteDialogItem}
        isManager={isManager}
        budget={{
          totalIndividualAllocated,
          totalIndividualTarget,
          pendingJointTotal,
          pendingJointPortion,
          pendingDiscretionaryPortion,
          jointAllocated: workspace.personalBudget.jointAllocated,
          jointTarget: workspace.personalBudget.jointTarget,
          discretionaryAllocated: workspace.personalBudget.discretionaryAllocated,
          discretionaryCap: workspace.personalBudget.discretionaryCap,
          totalBudgetRemaining,
        }}
        isVoteSaving={isVoteSaving}
        userId={workspace.user.id}
        onClose={() => {
          setVoteDialogProposalId(null);
          if (voteDialogProposalId) {
            setPendingJointAllocationByProposalId((prev) => {
              const next = { ...prev };
              delete next[voteDialogProposalId];
              return next;
            });
          }
        }}
        onSuccess={(proposalId) => {
          setPendingJointAllocationByProposalId((prev) => {
            const next = { ...prev };
            delete next[proposalId];
            return next;
          });
          setVoteDialogProposalId(null);
        }}
        onAllocationChange={(proposalId, amount) => {
          setPendingJointAllocationByProposalId((prev) => ({
            ...prev,
            [proposalId]: amount,
          }));
        }}
        onSavingChange={setIsVoteSaving}
      />

      {/* ── Walkthrough spotlight overlay ──────────────────────────── */}
      {walkthrough.isOpen &&
        walkthrough.spotlightRect &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[45] pointer-events-none" aria-hidden>
              <div
                className="bg-transparent"
                style={{
                  position: "fixed",
                  left: walkthrough.spotlightRect.left,
                  top: walkthrough.spotlightRect.top,
                  width: walkthrough.spotlightRect.width,
                  height: walkthrough.spotlightRect.height,
                  boxShadow:
                    "0 0 0 4px hsl(0 0% 0% / 0.45), 0 0 0 6px hsl(var(--accent)), 0 0 0 9999px hsl(0 0% 0% / 0.45)",
                  borderRadius: "0.75rem",
                }}
              />
            </div>
            <div className="fixed inset-0 z-[45] pointer-events-auto" aria-hidden>
              <div
                className="pointer-events-none"
                style={{
                  position: "fixed",
                  left: walkthrough.spotlightRect.left,
                  top: walkthrough.spotlightRect.top,
                  width: walkthrough.spotlightRect.width,
                  height: walkthrough.spotlightRect.height,
                }}
              />
            </div>
          </>,
          document.body,
        )}

      <Dialog
        open={walkthrough.isOpen}
        onOpenChange={(open) => {
          if (!open) walkthrough.close();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {walkthrough.currentStep && (
            <>
              <DialogHeader>
                <p className="text-xs font-medium text-muted-foreground" aria-hidden>
                  Step {walkthrough.step + 1} of {walkthrough.totalSteps}
                </p>
                <DialogTitle id="mobile-walkthrough-title">{walkthrough.currentStep.title}</DialogTitle>
                <DialogDescription id="mobile-walkthrough-description" className="mt-1 text-left">
                  {walkthrough.currentStep.body}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex-row flex-wrap gap-2 sm:justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="order-last sm:order-first text-muted-foreground"
                  onClick={walkthrough.close}
                >
                  Skip tour
                </Button>
                <div className="flex gap-2">
                  {!walkthrough.isFirst && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={walkthrough.back}
                    >
                      Back
                    </Button>
                  )}
                  {walkthrough.isLast ? (
                    <Button size="sm" onClick={walkthrough.close}>
                      Finish
                    </Button>
                  ) : (
                    <Button size="sm" onClick={walkthrough.next}>
                      Next
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
