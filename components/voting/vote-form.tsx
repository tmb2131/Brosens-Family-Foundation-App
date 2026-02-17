"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
}

export function VoteForm({
  proposalId,
  proposalType,
  proposedAmount,
  totalRequiredVotes,
  onSuccess,
  onAllocationChange,
  maxJointAllocation
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
  const [showZeroAllocationConfirm, setShowZeroAllocationConfirm] = useState(false);

  const effectiveAllocation =
    proposalType === "joint" && choice === "yes" ? (parsedAllocationAmount ?? 0) : 0;

  const onAllocationChangeRef = useRef(onAllocationChange);
  onAllocationChangeRef.current = onAllocationChange;
  useEffect(() => {
    onAllocationChangeRef.current?.(effectiveAllocation);
  }, [effectiveAllocation]);

  const submitVote = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setError(null);
    setSaving(true);
    setShowZeroAllocationConfirm(false);

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
          ...(choice === "flagged" && flagComment.trim() !== "" ? { flagComment: flagComment.trim() } : {})
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not save vote" }));
        throw new Error(payload.error || "Could not save vote");
      }

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
        `Allocation cannot exceed your total budget remaining (${currency(maxJointAllocation)}).`
      );
      return;
    }
    const isEmpty =
      proposalType === "joint" &&
      choice === "yes" &&
      allocationAmountRef.current.trim() === "";
    if (isEmpty) {
      setShowZeroAllocationConfirm(true);
      return;
    }
    void submitVote();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    trySubmit();
  };

  // Submit on button click (desktop). We don't rely on form submit for clicks
  // because when the allocation input has focus, blur/focus handling (e.g. in
  // Radix Dialog) can prevent the form submit event from firing on first click.
  const handleSubmitClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!saving) trySubmit();
  };

  // Fire submit on pointerdown (capture) so we run before blur/focus handling.
  // This fixes the first-click failure when the allocation input has focus inside
  // a Radix Dialog or other focus-trapping container.
  const handleSubmitPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || saving) return; // primary button only
    event.preventDefault();
    event.stopPropagation();
    trySubmit();
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    // On mobile, tapping this button while the allocation input has focus
    // dismisses the virtual keyboard, causing a layout shift that moves the
    // button away from the original touch coordinates. The browser then
    // decides the click didn't land on the button, so the form never submits.
    // Handling touchend directly captures the submit intent before the shift.
    if (!saving) {
      event.preventDefault();
      trySubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-2 border-t pt-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cast {proposalType} vote</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            setChoice(primaryChoice);
            setFlagComment("");
          }}
          variant={choice === primaryChoice ? "default" : "outline"}
          size="default"
          className={choice === primaryChoice
            ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
            : ""
          }
          type="button"
        >
          {proposalType === "joint" ? "Yes" : "Acknowledged"}
        </Button>
        <Button
          onClick={() => setChoice(secondaryChoice)}
          variant={choice === secondaryChoice ? "destructive" : "outline"}
          size="default"
          type="button"
        >
          {proposalType === "joint" ? "No" : "Flag for Discussion"}
        </Button>
      </div>

      {proposalType === "joint" ? (
        <>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Implied share: {currency(impliedJointAllocation)} each. You may enter a different amount.
          </p>
          <label className="mt-1.5 block text-xs font-medium">
            Allocation amount
            <div className="mt-1 flex items-center gap-2">
              <AmountInput
                min={0}
                disabled={choice !== "yes"}
                className="flex-1 rounded-lg placeholder:italic"
                placeholder={`Implied share: ${currency(impliedJointAllocation)}`}
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
                Exceeds your total budget remaining ({currency(maxJointAllocation)}).
              </p>
            ) : null}
          </label>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Amount is proposer-set. Acknowledge or flag for discussion.
          </p>
          {choice === "flagged" ? (
            <label className="mt-1.5 block text-xs font-medium">
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
        size="default"
        className="mt-2 w-full"
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
        {saving ? "Saving vote..." : "Submit Blind Vote"}
      </Button>

      {error ? (
        <div role="alert" className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Dialog open={showZeroAllocationConfirm} onOpenChange={setShowZeroAllocationConfirm}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Confirm allocation</DialogTitle>
            <DialogDescription>
              You didn&apos;t enter an amount. Submit a blind vote with an allocation of {currency(0)}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setShowZeroAllocationConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowZeroAllocationConfirm(false);
                void submitVote();
              }}
              disabled={saving}
            >
              Submit {currency(0)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
