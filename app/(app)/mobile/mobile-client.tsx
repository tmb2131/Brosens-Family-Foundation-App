"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { RefreshCw, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useMobileWalkthrough } from "@/components/mobile-walkthrough-context";
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
import { MobileGreetingHeader } from "./mobile-greeting-header";
import { MobileProfileSheet } from "./mobile-profile-sheet";
import { MobileNudgeCard } from "./mobile-nudge-card";
import { MobileActionItems } from "./mobile-action-items";
import { MobileVoteModal } from "./mobile-vote-modal";

const WALKTHROUGH_STEPS: Array<{
  target: string;
  title: string;
  body: string;
}> = [
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

export default function MobileFocusClient() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const workspaceQuery = useSWR<WorkspaceSnapshot>(user ? "/api/workspace" : null, {
    refreshInterval: 30_000,
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
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  useEffect(() => {
    return registerStartWalkthrough(() => {
      setWalkthroughStep(0);
      setWalkthroughOpen(true);
    });
  }, [registerStartWalkthrough]);

  const closeWalkthrough = useCallback(() => {
    setWalkthroughOpen(false);
    setWalkthroughStep(0);
    setSpotlightRect(null);
    try { localStorage.setItem("mobile-walkthrough-seen", "1"); } catch { /* noop */ }
  }, []);

  const measureAndSetRect = useCallback((stepIndex: number) => {
    const step = WALKTHROUGH_STEPS[stepIndex];
    if (!step) { setSpotlightRect(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-walkthrough="${step.target}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSpotlightRect({ left: r.left, top: r.top, width: r.width, height: r.height });
        return;
      }
    }
    setSpotlightRect(null);
  }, []);

  useLayoutEffect(() => {
    if (!walkthroughOpen) return;
    const step = WALKTHROUGH_STEPS[walkthroughStep];
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-walkthrough="${step.target}"]`);
    el?.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
    measureAndSetRect(walkthroughStep);
    const t1 = setTimeout(() => measureAndSetRect(walkthroughStep), 50);
    const t2 = setTimeout(() => measureAndSetRect(walkthroughStep), 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [walkthroughOpen, walkthroughStep, measureAndSetRect]);

  useEffect(() => {
    if (!walkthroughOpen) return;
    const handleResize = () => measureAndSetRect(walkthroughStep);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [walkthroughOpen, walkthroughStep, measureAndSetRect]);

  // Auto-show walkthrough on first visit
  useEffect(() => {
    if (!workspaceQuery.data) return;
    try {
      if (!localStorage.getItem("mobile-walkthrough-seen")) {
        setWalkthroughStep(0);
        setWalkthroughOpen(true);
      }
    } catch { /* noop */ }
  }, [workspaceQuery.data]);

  // ── Loading / Error ──────────────────────────────────────────────
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
          void workspaceQuery.mutate();
          mutateAllFoundation();
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
                  borderRadius: "0.75rem",
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
                  height: spotlightRect.height,
                }}
              />
            </div>
          </>,
          document.body,
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
                  <DialogTitle id="mobile-walkthrough-title">{step.title}</DialogTitle>
                  <DialogDescription id="mobile-walkthrough-description" className="mt-1 text-left">
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
    </div>
  );
}
