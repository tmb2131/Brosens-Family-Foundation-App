"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
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
}

export function VoteForm({
  proposalId,
  proposalType,
  proposedAmount,
  totalRequiredVotes,
  onSuccess,
  onAllocationChange
}: VoteFormProps) {
  const primaryChoice: VoteChoice = proposalType === "joint" ? "yes" : "acknowledged";
  const secondaryChoice: VoteChoice = proposalType === "joint" ? "no" : "flagged";
  const [choice, setChoice] = useState<VoteChoice>(primaryChoice);
  const impliedJointAllocation =
    totalRequiredVotes > 0 ? Math.round(proposedAmount / totalRequiredVotes) : Math.round(proposedAmount);
  const [allocationAmount, setAllocationAmount] = useState("");
  const allocationAmountRef = useRef(allocationAmount);
  allocationAmountRef.current = allocationAmount;
  const parsedAllocationAmount = parseNumberInput(allocationAmount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAllocation =
    proposalType === "joint" && choice === "yes" ? (parsedAllocationAmount ?? 0) : 0;

  const onAllocationChangeRef = useRef(onAllocationChange);
  onAllocationChangeRef.current = onAllocationChange;
  useEffect(() => {
    onAllocationChangeRef.current?.(effectiveAllocation);
  }, [effectiveAllocation]);

  const submitVote = async () => {
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
          allocationAmount: amountToSend
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
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitVote();
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    // On mobile, tapping this button while the allocation input has focus
    // dismisses the virtual keyboard, causing a layout shift that moves the
    // button away from the original touch coordinates. The browser then
    // decides the click didn't land on the button, so the form never submits.
    // Handling touchend directly captures the submit intent before the shift.
    if (!saving) {
      event.preventDefault();
      void submitVote();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 border-t pt-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cast {proposalType} vote</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <Button
          onClick={() => setChoice(primaryChoice)}
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
              <Input
                type="number"
                min={0}
                disabled={choice !== "yes"}
                className="flex-1 rounded-lg"
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
          </label>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Amount is proposer-set. Acknowledge or flag for discussion.
        </p>
      )}

      <Button
        size="default"
        className="mt-2 w-full"
        type="submit"
        disabled={saving}
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
    </form>
  );
}
