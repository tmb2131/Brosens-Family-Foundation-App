"use client";

import { useState } from "react";
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
}

export function VoteForm({
  proposalId,
  proposalType,
  proposedAmount,
  totalRequiredVotes,
  onSuccess
}: VoteFormProps) {
  const primaryChoice: VoteChoice = proposalType === "joint" ? "yes" : "acknowledged";
  const secondaryChoice: VoteChoice = proposalType === "joint" ? "no" : "flagged";
  const [choice, setChoice] = useState<VoteChoice>(primaryChoice);
  const impliedJointAllocation =
    totalRequiredVotes > 0 ? Math.round(proposedAmount / totalRequiredVotes) : Math.round(proposedAmount);
  const [allocationAmount, setAllocationAmount] = useState(String(Math.max(0, impliedJointAllocation)));
  const parsedAllocationAmount = parseNumberInput(allocationAmount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitVote = async () => {
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposalId,
          choice,
          allocationAmount:
            proposalType === "joint" && choice === "yes" ? Number(allocationAmount || 0) : 0
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

  return (
    <div className="mt-2 rounded-xl border bg-card/75 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cast {proposalType} vote</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          onClick={() => setChoice(primaryChoice)}
          variant={choice === primaryChoice ? "default" : "outline"}
          size="lg"
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
          size="lg"
          type="button"
        >
          {proposalType === "joint" ? "No" : "Flag for Discussion"}
        </Button>
      </div>

      {proposalType === "joint" ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Proposed joint amount implies {currency(impliedJointAllocation)} each. Enter your allocation amount; it
            can be more or less than {currency(impliedJointAllocation)} (including {currency(0)}).
          </p>
          <label className="mt-2 block text-xs font-medium">
            Allocation amount
            <Input
              type="number"
              min={0}
              disabled={choice !== "yes"}
              className="mt-1 rounded-lg"
              value={allocationAmount}
              onChange={(event) => setAllocationAmount(event.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Amount preview: {parsedAllocationAmount !== null ? currency(parsedAllocationAmount) : "—"}
            </p>
          </label>
        </>
      ) : (
          <p className="mt-2 text-xs text-muted-foreground">
          Proposed discretionary amount is {currency(proposedAmount)} and is proposer-set. Mark Acknowledged if
          ready, or Flag for Discussion to route the final Oversight approval/rejection in Meeting.
        </p>
      )}

      <Button
        size="lg"
        className="mt-3 w-full"
        type="button"
        onClick={() => void submitVote()}
        disabled={saving}
      >
        {saving ? "Saving vote..." : "Submit Blind Vote"}
      </Button>

      {error ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
