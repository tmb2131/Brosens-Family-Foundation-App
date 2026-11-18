"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AlertCircle, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import {
  ProposalType,
  type FoundationSnapshot,
  type NavigationSummarySnapshot,
  type VoteChoice,
  type WorkspaceSnapshot,
} from "@/lib/types";
import { cn, currency, parseNumberInput, voteChoiceLabel } from "@/lib/utils";
import { mutate as globalMutate } from "swr";
import { optimisticMutateMany } from "@/lib/swr-helpers";

interface VoteFormProps {
  proposalId: string;
  proposalType: ProposalType;
  proposedAmount: number;
  totalRequiredVotes: number;
  /** Current user id — used for optimistic cache updates. */
  userId: string;
  /** Proposal title — used for optimistic voteHistory entry. */
  proposalTitle: string;
  onSuccess: () => void;
  /** Called when the user changes allocation (joint only). Use to show live budget preview. */
  onAllocationChange?: (amount: number) => void;
  /** Max allowed allocation for joint votes (remaining budget + current vote on this proposal). When set, allocation over this is blocked. */
  maxJointAllocation?: number;
  /** Called whenever the saving state changes. Use to prevent modal dismiss during submission. */
  onSavingChange?: (isSaving: boolean) => void;
  className?: string;
}

interface VoteFormProviderProps extends VoteFormProps {
  variant: "mobile";
  children: React.ReactNode;
}

const PROPOSAL_DETAIL_KEY = /^\/api\/proposals\/[0-9a-f-]{36}$/i;

/**
 * Re-read every view that shows voting state. After a failed vote the rollback
 * only restores what this tab had, so when the vote was refused because one is
 * already recorded (cast from another tab or device), this replaces the stale
 * "vote now" state with the real one. After a successful vote it brings the
 * standalone proposal page (which the optimistic update does not cover) up to
 * date.
 */
function revalidateVoteViews() {
  return globalMutate(
    (key) =>
      typeof key === "string" &&
      (key === "/api/workspace" ||
        key === "/api/navigation/summary" ||
        key.startsWith("/api/foundation") ||
        PROPOSAL_DETAIL_KEY.test(key))
  );
}

function useVoteFormState(props: VoteFormProps) {
  const {
    proposalId,
    proposalType,
    proposedAmount,
    totalRequiredVotes,
    proposalTitle,
    onSuccess,
    onAllocationChange,
    maxJointAllocation,
    onSavingChange,
  } = props;

  const primaryChoice: VoteChoice = proposalType === "joint" ? "yes" : "acknowledged";
  const secondaryChoice: VoteChoice = proposalType === "joint" ? "no" : "flagged";
  const [choice, setChoice] = useState<VoteChoice>(primaryChoice);
  const [flagComment, setFlagComment] = useState("");
  const impliedJointAllocation =
    totalRequiredVotes > 0 ? Math.round(proposedAmount / totalRequiredVotes) : Math.round(proposedAmount);
  const [allocationAmount, setAllocationAmountState] = useState("");
  const [allocationTouched, setAllocationTouched] = useState(false);
  const allocationAmountRef = useRef(allocationAmount);
  allocationAmountRef.current = allocationAmount;
  const parsedAllocationAmount = parseNumberInput(allocationAmount);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const isJointYes = proposalType === "joint" && choice === "yes";
  const effectiveAllocation = isJointYes ? (parsedAllocationAmount ?? 0) : 0;
  const needsAmount = isJointYes && parsedAllocationAmount === null;
  const exceedsBudget =
    isJointYes && maxJointAllocation != null && (parsedAllocationAmount ?? 0) > maxJointAllocation;
  const canUseSuggestedAmount =
    isJointYes && (maxJointAllocation == null || impliedJointAllocation <= maxJointAllocation);

  const setAllocationAmount = useCallback((value: string) => {
    allocationAmountRef.current = value;
    setAllocationAmountState(value);
    setAllocationTouched(true);
    setError(null);
  }, []);

  const applySuggestedAmount = useCallback(() => {
    setAllocationAmount(String(impliedJointAllocation));
  }, [impliedJointAllocation, setAllocationAmount]);

  const onAllocationChangeRef = useRef(onAllocationChange);
  onAllocationChangeRef.current = onAllocationChange;
  useEffect(() => {
    onAllocationChangeRef.current?.(effectiveAllocation);
  }, [effectiveAllocation]);

  const onSavingChangeRef = useRef(onSavingChange);
  onSavingChangeRef.current = onSavingChange;
  useEffect(() => {
    onSavingChangeRef.current?.(saving);
  }, [saving]);

  const submitVote = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setError(null);
    setSaving(true);

    const amountToSend =
      proposalType === "joint" && choice === "yes"
        ? (parseNumberInput(allocationAmountRef.current) ?? 0)
        : 0;

    const votePayload = {
      proposalId,
      choice,
      allocationAmount: amountToSend,
      ...(choice === "flagged" && flagComment.trim() !== "" ? { flagComment: flagComment.trim() } : {}),
    };

    const doFetch = async () => {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(votePayload),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not save vote" }));
        throw new Error(payload.error || "Could not save vote");
      }
    };

    try {
      navigator.vibrate?.(10);
      setIsReviewing(false);

      // Mirrors the server's personal budget rule: a joint allocation draws on
      // the joint share first and spills over into discretionary.
      const workspaceUpdater = (ws: WorkspaceSnapshot): WorkspaceSnapshot => {
        const jointAmount = proposalType === "joint" ? amountToSend : 0;
        const fromJoint = Math.min(jointAmount, Math.max(0, ws.personalBudget.jointRemaining));
        const overflow = jointAmount - fromJoint;
        return {
          ...ws,
          actionItems: ws.actionItems.filter((item) => item.proposalId !== proposalId),
          voteHistory: [
            { proposalId, proposalTitle, choice, amount: amountToSend, at: new Date().toISOString() },
            ...ws.voteHistory,
          ],
          personalBudget: {
            ...ws.personalBudget,
            jointAllocated: ws.personalBudget.jointAllocated + fromJoint,
            jointRemaining: Math.max(0, ws.personalBudget.jointRemaining - fromJoint),
            discretionaryAllocated: ws.personalBudget.discretionaryAllocated + overflow,
            discretionaryRemaining: Math.max(0, ws.personalBudget.discretionaryRemaining - overflow),
          },
        };
      };

      // The foundation budget counts an open proposal at its requested amount,
      // so a vote changes the proposal's progress but not the budget figures.
      const foundationUpdater = (fd: FoundationSnapshot): FoundationSnapshot => ({
        ...fd,
        proposals: fd.proposals.map((p) => {
          if (p.id !== proposalId) return p;
          const newVotesSubmitted = p.progress.votesSubmitted + 1;
          return {
            ...p,
            progress: {
              ...p.progress,
              hasCurrentUserVoted: true,
              votesSubmitted: newVotesSubmitted,
              masked: false,
              isReadyForMeeting: newVotesSubmitted >= p.progress.totalRequiredVotes,
            },
          };
        }),
      });

      const navUpdater = (nav: NavigationSummarySnapshot): NavigationSummarySnapshot => ({
        ...nav,
        workspaceActionItemsCount: Math.max(0, nav.workspaceActionItemsCount - 1),
        dashboardToReviewCount: Math.max(0, nav.dashboardToReviewCount - 1),
      });

      await optimisticMutateMany(
        [
          { key: "/api/workspace", updater: workspaceUpdater },
          { key: "/api/navigation/summary", updater: navUpdater },
          { key: (key) => typeof key === "string" && /^\/api\/foundation(\?|$)/.test(key), updater: foundationUpdater },
        ],
        doFetch,
        { onOptimisticApplied: onSuccess },
      );
      toast.success("Vote submitted");
      void revalidateVoteViews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save vote");
      void revalidateVoteViews();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    proposalId,
    proposalType,
    proposalTitle,
    choice,
    flagComment,
    onSuccess,
  ]);

  /** Validates the form and moves to the review step. Votes are final, so there is always a review. */
  const trySubmit = useCallback(() => {
    if (savingRef.current) return;
    setError(null);
    if (proposalType === "joint" && choice === "yes") {
      const amount = parseNumberInput(allocationAmountRef.current);
      if (amount === null) {
        setError(`Enter your amount, or use the suggested ${currency(impliedJointAllocation)}.`);
        return;
      }
      if (maxJointAllocation != null && amount > maxJointAllocation) {
        setError(
          `Your allocation cannot exceed your total budget remaining (${currency(maxJointAllocation)}).`
        );
        return;
      }
    }
    setIsReviewing(true);
  }, [proposalType, choice, impliedJointAllocation, maxJointAllocation]);

  const disabled = saving || needsAmount || exceedsBudget;
  const label = saving ? "Saving..." : "Submit Vote";

  return {
    proposalType,
    primaryChoice,
    secondaryChoice,
    choice,
    setChoice,
    flagComment,
    setFlagComment,
    allocationAmount,
    setAllocationAmount,
    allocationTouched,
    impliedJointAllocation,
    parsedAllocationAmount,
    maxJointAllocation,
    proposedAmount,
    exceedsBudget,
    canUseSuggestedAmount,
    applySuggestedAmount,
    error,
    trySubmit,
    submitVote,
    disabled,
    label,
    saving,
    isReviewing,
    setIsReviewing,
  };
}

type VoteFormState = ReturnType<typeof useVoteFormState>;

const VoteFormContext = createContext<VoteFormState | null>(null);

export function VoteFormProvider({ variant, children, ...props }: VoteFormProviderProps) {
  void variant;
  const state = useVoteFormState(props);
  return <VoteFormContext.Provider value={state}>{children}</VoteFormContext.Provider>;
}

/**
 * Submit the vote on pointer down as well as click: on iOS the first tap after
 * typing in the amount field otherwise only dismisses the keyboard, and the
 * layout shift that follows makes the click miss the button.
 */
function submitButtonHandlers(state: Pick<VoteFormState, "trySubmit" | "saving" | "disabled">) {
  const { trySubmit, saving, disabled } = state;
  return {
    onPointerDownCapture: (event: React.PointerEvent) => {
      if (event.button !== 0 || saving || disabled) return;
      event.preventDefault();
      event.stopPropagation();
      trySubmit();
    },
    onClick: (event: React.MouseEvent) => {
      event.preventDefault();
      if (!saving && !disabled) trySubmit();
    },
    onTouchEnd: (event: React.TouchEvent) => {
      if (saving || disabled) return;
      event.preventDefault();
      trySubmit();
    },
  };
}

function ReviewActions({ state, className }: { state: VoteFormState; className?: string }) {
  const { saving, setIsReviewing, submitVote } = state;
  return (
    <div className={cn("grid w-full grid-cols-2 gap-3", className)}>
      <Button
        variant="outline"
        size="lg"
        type="button"
        disabled={saving}
        onClick={() => setIsReviewing(false)}
      >
        Go back
      </Button>
      <Button size="lg" type="button" disabled={saving} onClick={() => void submitVote()}>
        {saving ? "Saving..." : "Confirm vote"}
      </Button>
    </div>
  );
}

export function VoteFormFooterButton() {
  const ctx = useContext(VoteFormContext);
  if (!ctx) return null;

  if (ctx.isReviewing) {
    return <ReviewActions state={ctx} />;
  }

  return (
    <Button size="lg" className="w-full" type="button" disabled={ctx.disabled} {...submitButtonHandlers(ctx)}>
      {ctx.label}
    </Button>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
    >
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function VoteReview({ state }: { state: VoteFormState }) {
  const { proposalType, choice, primaryChoice, parsedAllocationAmount, proposedAmount, flagComment, error } = state;
  const isJointYes = proposalType === "joint" && choice === "yes";
  const allocation = parsedAllocationAmount ?? 0;

  return (
    <div className="text-sm">
      <p className="text-base font-semibold text-foreground">Review your vote</p>
      <p className="mt-1 text-sm text-muted-foreground">Check the details below, then confirm.</p>

      <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-muted/60 p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Proposed amount
          </dt>
          <dd className="text-right text-base font-bold tabular-nums">{currency(proposedAmount)}</dd>
        </div>

        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vote</dt>
          <dd
            className={cn(
              "text-right font-semibold",
              choice === primaryChoice ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            )}
          >
            {voteChoiceLabel(choice)}
          </dd>
        </div>

        {isJointYes ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your allocation
            </dt>
            <dd className="flex items-center justify-end gap-1.5 text-right text-base font-bold tabular-nums">
              {allocation === 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              {currency(allocation)}
            </dd>
          </div>
        ) : null}

        {choice === "flagged" && flagComment.trim() ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comment</dt>
            <dd className="whitespace-pre-wrap text-right">{flagComment.trim()}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Votes are final.</strong> You can&apos;t change your vote after you
          confirm. It stays hidden from others until all votes are in.
        </span>
      </p>

      {isJointYes && allocation === 0 ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>You&apos;re about to vote yes with an allocation of {currency(0)}.</p>
        </div>
      ) : null}

      {error ? <ErrorNotice message={error} /> : null}
    </div>
  );
}

function VoteFields({ state, heading }: { state: VoteFormState; heading: string }) {
  const {
    proposalType,
    choice,
    setChoice,
    flagComment,
    setFlagComment,
    allocationAmount,
    setAllocationAmount,
    allocationTouched,
    impliedJointAllocation,
    parsedAllocationAmount,
    maxJointAllocation,
    proposedAmount,
    exceedsBudget,
    canUseSuggestedAmount,
    applySuggestedAmount,
    primaryChoice,
    secondaryChoice,
    error,
  } = state;
  const amountInputId = useId();
  const isJoint = proposalType === "joint";
  const suggestionApplied = parsedAllocationAmount === impliedJointAllocation;

  return (
    <>
      <p className="text-base font-semibold text-foreground">{heading}</p>
      <div className="mt-3 grid grid-cols-2 gap-3" role="group" aria-label="Your vote">
        <Button
          onClick={() => {
            setChoice(primaryChoice);
            setFlagComment("");
          }}
          variant={choice === primaryChoice ? "default" : "outline"}
          size="default"
          className={cn("h-11", choice === primaryChoice && "bg-emerald-600 text-white hover:bg-emerald-600/90")}
          type="button"
          aria-pressed={choice === primaryChoice}
        >
          {isJoint ? "Yes" : "Acknowledge"}
        </Button>
        <Button
          onClick={() => setChoice(secondaryChoice)}
          variant={choice === secondaryChoice ? "destructive" : "outline"}
          size="default"
          className="h-11"
          type="button"
          aria-pressed={choice === secondaryChoice}
        >
          {isJoint ? "No" : "Flag for Discussion"}
        </Button>
      </div>

      {isJoint && choice === "yes" ? (
        <div className="mt-4">
          <label htmlFor={amountInputId} className="block text-base font-semibold text-foreground">
            Your amount
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <AmountInput
              id={amountInputId}
              min={0}
              className="flex-1 rounded-lg"
              placeholder="Enter amount"
              value={allocationAmount}
              aria-invalid={exceedsBudget || undefined}
              onChange={(event) => setAllocationAmount(event.target.value)}
            />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" aria-hidden>
              {parsedAllocationAmount !== null ? currency(parsedAllocationAmount) : "—"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              Equal share of {currency(proposedAmount)}: {currency(impliedJointAllocation)}
            </span>
            {canUseSuggestedAmount && !suggestionApplied ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={applySuggestedAmount}
              >
                Use {currency(impliedJointAllocation)}
              </Button>
            ) : null}
          </div>
          {exceedsBudget && maxJointAllocation != null ? (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              Exceeds your remaining budget ({currency(maxJointAllocation)}).
            </p>
          ) : null}
          {allocationTouched && parsedAllocationAmount === 0 ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Your allocation is $0.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isJoint ? (
        <p className="mt-2 text-xs text-muted-foreground">
          The proposer sets the amount for a discretionary gift. Acknowledge it, or flag it to discuss at the
          meeting.
        </p>
      ) : null}

      {!isJoint && choice === "flagged" ? (
        <label className="mt-3 block text-xs font-medium">
          Comment (optional)
          <Input
            className="mt-1 rounded-lg placeholder:italic"
            placeholder="e.g. Would like to discuss amount or scope"
            value={flagComment}
            onChange={(e) => setFlagComment(e.target.value)}
            maxLength={500}
          />
        </label>
      ) : null}

      {error ? <ErrorNotice message={error} /> : null}
    </>
  );
}

/** Body of the vote form when rendered inside VoteFormProvider; the provider's footer holds the button. */
function VoteFormContent() {
  const ctx = useContext(VoteFormContext);
  if (!ctx) return null;

  if (ctx.isReviewing) {
    return (
      <div className="pt-4">
        <VoteReview state={ctx} />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        ctx.trySubmit();
      }}
      noValidate
      className="pt-4 text-sm"
    >
      <VoteFields state={ctx} heading="Your vote?" />
    </form>
  );
}

export function VoteForm(props: VoteFormProps) {
  const context = useContext(VoteFormContext);
  if (context) {
    return <VoteFormContent />;
  }
  return <VoteFormStandalone {...props} />;
}

function VoteFormStandalone(props: VoteFormProps) {
  const state = useVoteFormState(props);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        state.trySubmit();
      }}
      noValidate
      className={cn("mt-0 border-t pt-4 text-sm", props.className)}
    >
      {state.isReviewing ? (
        <>
          <VoteReview state={state} />
          <ReviewActions state={state} className="mt-4" />
        </>
      ) : (
        <>
          <VoteFields state={state} heading={`Cast ${props.proposalType} vote`} />
          <Button
            size="lg"
            className="mt-4 w-full"
            type="submit"
            disabled={state.disabled}
            {...submitButtonHandlers(state)}
          >
            {state.label}
          </Button>
        </>
      )}
    </form>
  );
}
