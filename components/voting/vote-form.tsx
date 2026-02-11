"use client";

import { useState } from "react";
import { ProposalType } from "@/lib/types";
import { currency } from "@/lib/utils";

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
  const [choice, setChoice] = useState<"yes" | "no">("yes");
  const impliedJointAllocation =
    totalRequiredVotes > 0 ? Math.round(proposedAmount / totalRequiredVotes) : Math.round(proposedAmount);
  const [allocationAmount, setAllocationAmount] = useState(String(Math.max(0, impliedJointAllocation)));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vote");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border bg-white/75 p-3 text-sm dark:bg-zinc-900/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cast {proposalType} vote</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => setChoice("yes")}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold sm:text-xs ${
            choice === "yes"
              ? "bg-emerald-600 text-white"
              : "border bg-white text-zinc-600 dark:bg-zinc-900"
          }`}
          type="button"
        >
          Yes
        </button>
        <button
          onClick={() => setChoice("no")}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold sm:text-xs ${
            choice === "no"
              ? "bg-rose-600 text-white"
              : "border bg-white text-zinc-600 dark:bg-zinc-900"
          }`}
          type="button"
        >
          No
        </button>
      </div>

      {proposalType === "joint" ? (
        <>
          <p className="mt-2 text-xs text-zinc-500">
            Proposed joint amount implies {currency(impliedJointAllocation)} each. Enter your allocation amount; it
            can be more or less than {currency(impliedJointAllocation)} (including {currency(0)}).
          </p>
          <label className="mt-2 block text-xs font-medium">
            Allocation amount
            <input
              type="number"
              min={0}
              disabled={choice === "no"}
              className="mt-1 min-h-11 w-full rounded-lg border px-2 py-2 text-sm"
              value={allocationAmount}
              onChange={(event) => setAllocationAmount(event.target.value)}
            />
          </label>
        </>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Proposed discretionary amount is {currency(proposedAmount)} and is set by the proposer. Your vote is
          approval only.
        </p>
      )}

      <button
        className="mt-3 min-h-11 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:text-xs"
        type="button"
        onClick={() => void submitVote()}
        disabled={saving}
      >
        {saving ? "Saving vote..." : "Submit Blind Vote"}
      </button>

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
