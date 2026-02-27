"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { ProposalType, type VoteChoice } from "@/lib/types";
import { currency, parseNumberInput } from "@/lib/utils";

interface VoteFormProps {
  proposalId: string;
  proposalType: ProposalType;
  proposedAmount: number;
  totalRequiredVotes: number;
  onSuccess: () => void;
  /** Called when the user changes allocation (joint only). Use to show live budget preview. */
  onAllocationChange?: (amount: number) => void;
  /** Max allowed allocation for joint votes (remaining budget + current vote on this proposal). When set, allocation over this is blocked. */
  maxJointAllocation?: number;
  /** Called whenever the saving state changes. Use to prevent modal dismiss during submission. */
  onSavingChange?: (isSaving: boolean) => void;
}

/** When true, trySubmit validates and submits directly (no review step). Used for mobile drawer. */
interface VoteFormProviderProps extends VoteFormProps {
  variant: "mobile";
  children: React.ReactNode;
}

type VoteFormContextValue = {
  variant: "mobile";
  proposalType: ProposalType;
  choice: VoteChoice;
  setChoice: (c: VoteChoice) => void;
  flagComment: string;
  setFlagComment: (s: string) => void;
  allocationAmount: string;
  setAllocationAmount: (s: string) => void;
  allocationAmountRef: React.MutableRefObject<string>;
  impliedJointAllocation: number;
  parsedAllocationAmount: number | null;
  maxJointAllocation: number | undefined;
  proposedAmount: number;
  error: string | null;
  trySubmit: () => void;
  disabled: boolean;
  label: string;
  saving: boolean;
  primaryChoice: VoteChoice;
  secondaryChoice: VoteChoice;
  isReviewing: boolean;
  setIsReviewing: (v: boolean) => void;
  submitVote: () => void;
};

const VoteFormContext = createContext<VoteFormContextValue | null>(null);

function useVoteFormState(
  props: VoteFormProps,
  options: { skipReviewStep?: boolean }
) {
  const {
    proposalId,
    proposalType,
    proposedAmount,
    totalRequiredVotes,
    onSuccess,
    onAllocationChange,
    maxJointAllocation,
    onSavingChange,
  } = props;
  const { skipReviewStep = false } = options;

  const primaryChoice: VoteChoice = proposalType === "joint" ? "yes" : "acknowledged";
  const secondaryChoice: VoteChoice = proposalType === "joint" ? "no" : "flagged";
  const [choice, setChoice] = useState<VoteChoice>(primaryChoice);
  const [flagComment, setFlagComment] = useState("");
  const impliedJointAllocation =
    totalRequiredVotes > 0 ? Math.round(proposedAmount / totalRequiredVotes) : Math.round(proposedAmount);
  const [allocationAmount, setAllocationAmount] = useState("");
  const allocationAmountRef = useRef(allocationAmount);
  allocationAmountRef.current = allocationAmount;
  const parsedAllocationAmount = parseNumberInput(allocationAmount);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const effectiveAllocation =
    proposalType === "joint" && choice === "yes" ? (parsedAllocationAmount ?? 0) : 0;

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

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposalId,
          choice,
          allocationAmount: amountToSend,
          ...(choice === "flagged" && flagComment.trim() !== "" ? { flagComment: flagComment.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not save vote" }));
        throw new Error(payload.error || "Could not save vote");
      }

      navigator.vibrate?.(10);
      setIsReviewing(false);
      onSuccess();
      void mutate("/api/navigation/summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vote");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    proposalId,
    proposalType,
    choice,
    flagComment,
    onSuccess,
  ]);

  const trySubmit = useCallback(() => {
    setError(null);
    const amount = parseNumberInput(allocationAmountRef.current) ?? 0;
    if (
      proposalType === "joint" &&
      choice === "yes" &&
      maxJointAllocation != null &&
      amount > maxJointAllocation
    ) {
      setError(
        `Your allocation cannot exceed your total budget remaining (${currency(maxJointAllocation)}).`
      );
      return;
    }
    if (skipReviewStep) {
      void submitVote();
    } else {
      setIsReviewing(true);
    }
  }, [
    proposalType,
    choice,
    maxJointAllocation,
    skipReviewStep,
    submitVote,
  ]);

  const disabled =
    saving ||
    (proposalType === "joint" &&
      choice === "yes" &&
      maxJointAllocation != null &&
      (parsedAllocationAmount ?? 0) > maxJointAllocation);

  const label = saving ? "Saving..." : "Submit blind vote";

  return {
    primaryChoice,
    secondaryChoice,
    choice,
    setChoice,
    flagComment,
    setFlagComment,
    allocationAmount,
    setAllocationAmount,
    allocationAmountRef,
    impliedJointAllocation,
    parsedAllocationAmount,
    maxJointAllocation,
    proposedAmount,
    totalRequiredVotes,
    error,
    trySubmit,
    submitVote,
    disabled,
    label,
    saving,
    savingRef,
    isReviewing,
    setIsReviewing,
    proposalType,
  };
}

export function VoteFormProvider({ variant, children, ...props }: VoteFormProviderProps) {
  const state = useVoteFormState(props, { skipReviewStep: false });
  const value: VoteFormContextValue = {
    variant: "mobile",
    proposalType: state.proposalType,
    choice: state.choice,
    setChoice: state.setChoice,
    flagComment: state.flagComment,
    setFlagComment: state.setFlagComment,
    allocationAmount: state.allocationAmount,
    setAllocationAmount: state.setAllocationAmount,
    allocationAmountRef: state.allocationAmountRef,
    impliedJointAllocation: state.impliedJointAllocation,
    parsedAllocationAmount: state.parsedAllocationAmount,
    maxJointAllocation: state.maxJointAllocation,
    proposedAmount: state.proposedAmount,
    error: state.error,
    trySubmit: state.trySubmit,
    disabled: state.disabled,
    label: state.label,
    saving: state.saving,
    primaryChoice: state.primaryChoice,
    secondaryChoice: state.secondaryChoice,
    isReviewing: state.isReviewing,
    setIsReviewing: state.setIsReviewing,
    submitVote: state.submitVote,
  };
  return (
    <VoteFormContext.Provider value={value}>
      {children}
    </VoteFormContext.Provider>
  );
}

/** Renders the "Proposed: $X" header subtitle. Hides itself on the review/confirmation screen. */
export function VoteFormHeaderAmount({ proposedAmount }: { proposedAmount: number }) {
  const isReviewing = useContext(VoteFormContext)?.isReviewing ?? false;
  if (isReviewing) return null;
  return (
    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
      Proposed: {currency(proposedAmount)}
    </p>
  );
}

export function VoteFormFooterButton() {
  const ctx = useContext(VoteFormContext);
  if (!ctx) return null;
  const { trySubmit, disabled, label, saving, isReviewing, setIsReviewing, submitVote } = ctx;

  if (isReviewing) {
    return (
      <div className="grid w-full grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="lg"
          type="button"
          disabled={saving}
          onClick={() => setIsReviewing(false)}
        >
          Go Back
        </Button>
        <Button
          size="lg"
          type="button"
          disabled={saving}
          onClick={() => submitVote()}
        >
          {saving ? "Saving..." : "Confirm"}
        </Button>
      </div>
    );
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || saving) return;
    e.preventDefault();
    e.stopPropagation();
    trySubmit();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!saving) {
      e.preventDefault();
      trySubmit();
    }
  };
  return (
    <Button
      size="lg"
      className="w-full"
      type="button"
      disabled={disabled}
      onPointerDownCapture={handlePointerDown}
      onClick={(e) => {
        e.preventDefault();
        if (!saving) trySubmit();
      }}
      onTouchEnd={handleTouchEnd}
    >
      {label}
    </Button>
  );
}

function VoteFormContent() {
  const ctx = useContext(VoteFormContext);
  if (!ctx) return null;
  const {
    proposalType,
    choice,
    setChoice,
    flagComment,
    setFlagComment,
    allocationAmount,
    setAllocationAmount,
    allocationAmountRef,
    impliedJointAllocation,
    parsedAllocationAmount,
    maxJointAllocation,
    proposedAmount,
    error,
    primaryChoice,
    secondaryChoice,
    isReviewing,
  } = ctx;

  const showAllocation = proposalType === "joint" && choice === "yes";
  const showFlagComment = proposalType !== "joint" && choice === "flagged";

  if (isReviewing) {
    const isZeroAllocation = proposalType === "joint" && choice === "yes" && (parsedAllocationAmount ?? 0) === 0;
    return (
      <div className="mt-0 border-t border-transparent pt-4 text-sm">
        <p className="text-base font-semibold">Review your blind vote</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm the details below before submitting.
        </p>

        <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-muted/60 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Proposed amount
            </dt>
            <dd className="text-right text-base font-bold tabular-nums">{currency(proposedAmount)}</dd>
          </div>

          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vote</dt>
            <dd className={`text-right font-semibold ${choice === primaryChoice ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {choice === "yes" ? "Yes" : choice === "no" ? "No" : choice === "acknowledged" ? "Acknowledged" : "Flag for Discussion"}
            </dd>
          </div>

          {proposalType === "joint" && choice === "yes" && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your allocation
              </dt>
              <dd className="flex items-center justify-end gap-1.5 text-right font-medium tabular-nums">
                {(parsedAllocationAmount ?? 0) === 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                {currency(parsedAllocationAmount ?? 0)}
              </dd>
            </div>
          )}

          {choice === "flagged" && flagComment.trim() && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comment</dt>
              <dd className="text-right">{flagComment.trim()}</dd>
            </div>
          )}
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">
          Your vote is blind — individual votes stay hidden until all required votes are submitted.
        </p>

        {isZeroAllocation && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>You&apos;re about to submit your allocation of {currency(0)}. This will count as a yes vote with no amount.</p>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{error}</span>
          </div>
        )}
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
      className="mt-0 border-t border-transparent pt-4 text-sm"
    >
      <p className="text-base font-semibold text-foreground">Your vote?</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button
          onClick={() => {
            setChoice(primaryChoice);
            setFlagComment("");
          }}
          variant={choice === primaryChoice ? "default" : "outline"}
          size="default"
          className={`h-11 ${choice === primaryChoice ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""}`}
          type="button"
        >
          {proposalType === "joint" ? "Yes" : "Acknowledged"}
        </Button>
        <Button
          onClick={() => setChoice(secondaryChoice)}
          variant={choice === secondaryChoice ? "destructive" : "outline"}
          size="default"
          className="h-11"
          type="button"
        >
          {proposalType === "joint" ? "No" : "Flag for Discussion"}
        </Button>
      </div>

      {showAllocation ? (
        <label className="mt-4 block">
          <span className="block text-base font-semibold text-foreground">Your amount</span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Suggested: {currency(impliedJointAllocation)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <AmountInput
              min={0}
              className="flex-1 rounded-lg placeholder:italic"
              placeholder={currency(impliedJointAllocation)}
              value={allocationAmount}
              onChange={(event) => {
                const v = event.target.value;
                setAllocationAmount(v);
                allocationAmountRef.current = v;
              }}
            />
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {parsedAllocationAmount !== null ? currency(parsedAllocationAmount) : "—"}
            </span>
          </div>
          {maxJointAllocation != null && (parsedAllocationAmount ?? 0) > maxJointAllocation ? (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              Exceeds your remaining budget ({currency(maxJointAllocation)}).
            </p>
          ) : null}
          {(parsedAllocationAmount ?? 0) === 0 ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Your allocation is $0.
            </p>
          ) : null}
        </label>
      ) : null}

      {showFlagComment ? (
        <label className="mt-4 block text-xs font-medium">
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

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
        >
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
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

function VoteFormStandalone({
  proposalId,
  proposalType,
  proposedAmount,
  totalRequiredVotes,
  onSuccess,
  onAllocationChange,
  maxJointAllocation,
  onSavingChange,
}: VoteFormProps) {
  const primaryChoice: VoteChoice = proposalType === "joint" ? "yes" : "acknowledged";
  const secondaryChoice: VoteChoice = proposalType === "joint" ? "no" : "flagged";
  const [choice, setChoice] = useState<VoteChoice>(primaryChoice);
  const [flagComment, setFlagComment] = useState("");
  const impliedJointAllocation =
    totalRequiredVotes > 0 ? Math.round(proposedAmount / totalRequiredVotes) : Math.round(proposedAmount);
  const [allocationAmount, setAllocationAmount] = useState("");
  const allocationAmountRef = useRef(allocationAmount);
  allocationAmountRef.current = allocationAmount;
  const parsedAllocationAmount = parseNumberInput(allocationAmount);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const effectiveAllocation =
    proposalType === "joint" && choice === "yes" ? (parsedAllocationAmount ?? 0) : 0;

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

  const submitVote = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setError(null);
    setSaving(true);

    const amountToSend =
      proposalType === "joint" && choice === "yes"
        ? (parseNumberInput(allocationAmountRef.current) ?? 0)
        : 0;

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposalId,
          choice,
          allocationAmount: amountToSend,
          ...(choice === "flagged" && flagComment.trim() !== "" ? { flagComment: flagComment.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not save vote" }));
        throw new Error(payload.error || "Could not save vote");
      }

      navigator.vibrate?.(10);
      setIsReviewing(false);
      onSuccess();
      void mutate("/api/navigation/summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vote");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const trySubmit = () => {
    setError(null);
    const amount = parseNumberInput(allocationAmountRef.current) ?? 0;
    if (
      proposalType === "joint" &&
      choice === "yes" &&
      maxJointAllocation != null &&
      amount > maxJointAllocation
    ) {
      setError(
        `Your allocation cannot exceed your total budget remaining (${currency(maxJointAllocation)}).`
      );
      return;
    }
    setIsReviewing(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    trySubmit();
  };

  const handleSubmitClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!saving) trySubmit();
  };

  const handleSubmitPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || saving) return;
    event.preventDefault();
    event.stopPropagation();
    trySubmit();
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!saving) {
      event.preventDefault();
      trySubmit();
    }
  };

  const confirmedAmount = parseNumberInput(allocationAmountRef.current) ?? 0;
  const isZeroAllocation = proposalType === "joint" && choice === "yes" && confirmedAmount === 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-0 border-t pt-4 text-sm">
      {isReviewing ? (
        <>
          <p className="text-base font-semibold text-foreground">Review your blind vote</p>
          <div className="mt-3 rounded-xl border-2 border-border bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed amount</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{currency(proposedAmount)}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vote</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {proposalType === "joint" ? (
                <>{choice === "yes" ? "Yes" : "No"}</>
              ) : (
                <>{choice === "acknowledged" ? "Acknowledged" : "Flag for Discussion"}</>
              )}
            </p>
            {proposalType === "joint" && choice === "yes" ? (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your allocation</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums text-foreground">
                  {confirmedAmount === 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                  {currency(confirmedAmount)}
                </p>
              </>
            ) : null}
            {proposalType !== "joint" && choice === "flagged" && flagComment.trim() !== "" ? (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comment</p>
                <p className="mt-0.5 text-sm text-foreground">{flagComment.trim()}</p>
              </>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Your vote is blind — individual votes stay hidden until all required votes are submitted.
          </p>
          {isZeroAllocation ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                You&apos;re about to submit your allocation of {currency(0)}. This will count as a yes vote with no amount in your allocation.
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setIsReviewing(false)}
              disabled={saving}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              onClick={() => void submitVote()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-foreground">Cast {proposalType} vote</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              onClick={() => {
                setChoice(primaryChoice);
                setFlagComment("");
              }}
              variant={choice === primaryChoice ? "default" : "outline"}
              size="default"
              className={`h-11 ${choice === primaryChoice ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""}`}
              type="button"
            >
              {proposalType === "joint" ? "Yes" : "Acknowledged"}
            </Button>
            <Button
              onClick={() => setChoice(secondaryChoice)}
              variant={choice === secondaryChoice ? "destructive" : "outline"}
              size="default"
              className="h-11"
              type="button"
            >
              {proposalType === "joint" ? "No" : "Flag for Discussion"}
            </Button>
          </div>

          {proposalType === "joint" ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Proposed donation: $15,000. Implied share: $5,000 each. You may enter a different amount.
              </p>
              <label className="mt-3 block">
                <span className="block text-base font-semibold text-foreground">
                  Your allocation
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <AmountInput
                    min={0}
                    disabled={choice !== "yes"}
                    className="flex-1 rounded-lg placeholder:italic"
                    placeholder={`Your implied share: ${currency(impliedJointAllocation)}`}
                    value={allocationAmount}
                    onChange={(event) => {
                      const v = event.target.value;
                      setAllocationAmount(v);
                      allocationAmountRef.current = v;
                    }}
                  />
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {parsedAllocationAmount !== null ? currency(parsedAllocationAmount) : "—"}
                  </span>
                </div>
                {maxJointAllocation != null &&
                choice === "yes" &&
                (parsedAllocationAmount ?? 0) > maxJointAllocation ? (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    Your allocation exceeds your total budget remaining ({currency(maxJointAllocation)}).
                  </p>
                ) : null}
                {choice === "yes" && (parsedAllocationAmount ?? 0) === 0 ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Your allocation is $0.
                  </p>
                ) : null}
              </label>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Amount is proposer-set. Acknowledge or flag for discussion.
              </p>
              {choice === "flagged" ? (
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
            </>
          )}

          <Button
            size="lg"
            className="mt-4 w-full"
            type="submit"
            disabled={
              saving ||
              (proposalType === "joint" &&
                choice === "yes" &&
                maxJointAllocation != null &&
                (parsedAllocationAmount ?? 0) > maxJointAllocation)
            }
            onPointerDownCapture={handleSubmitPointerDown}
            onClick={handleSubmitClick}
            onTouchEnd={handleTouchEnd}
          >
            Submit Blind Vote
          </Button>
        </>
      )}

      {error ? (
        <div role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </form>
  );
}
