"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency } from "@/lib/utils";

interface ProposalTitleSuggestionsResponse {
  titles: string[];
}

export default function NewProposalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const workspaceQuery = useSWR<WorkspaceSnapshot>(
    user ? "/api/workspace" : null,
    { refreshInterval: 10_000 }
  );
  const titleSuggestionsQuery = useSWR<ProposalTitleSuggestionsResponse>(
    user ? "/api/proposals/titles" : null
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proposalType, setProposalType] = useState<"joint" | "discretionary">("joint");
  const [proposedAmount, setProposedAmount] = useState("25000");
  const allocationMode: "sum" = "sum";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discretionaryLimit = workspaceQuery.data
    ? Math.max(0, Math.floor(workspaceQuery.data.personalBudget.discretionaryRemaining))
    : null;
  const allTitleSuggestions = titleSuggestionsQuery.data?.titles ?? [];
  const normalizedTitle = title.trim().toLowerCase();
  const matchingTitleSuggestions = useMemo(() => {
    if (!allTitleSuggestions.length) {
      return [];
    }

    if (!normalizedTitle) {
      return allTitleSuggestions.slice(0, 12);
    }

    const startsWithMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const suggestion of allTitleSuggestions) {
      const normalizedSuggestion = suggestion.trim().toLowerCase();
      if (!normalizedSuggestion.includes(normalizedTitle)) {
        continue;
      }

      if (normalizedSuggestion.startsWith(normalizedTitle)) {
        startsWithMatches.push(suggestion);
      } else {
        containsMatches.push(suggestion);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 12);
  }, [allTitleSuggestions, normalizedTitle]);
  const hasExactTitleSuggestion = normalizedTitle
    ? allTitleSuggestions.some((suggestion) => suggestion.trim().toLowerCase() === normalizedTitle)
    : false;

  if (!user) {
    return null;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          proposalType,
          allocationMode,
          proposedAmount: Number(proposedAmount || 0)
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to submit" }));
        throw new Error(payload.error || "Failed to submit");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <CardTitle>Submission Flow</CardTitle>
        <CardValue>New Giving Idea</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Proposals are added to the full grant list and move to blind voting by eligible voters.
        </p>
      </Card>

      <Card>
        <CardTitle>Your Individual Budget</CardTitle>
        {workspaceQuery.isLoading ? (
          <p className="mt-2 text-sm text-zinc-500">Loading budget details...</p>
        ) : workspaceQuery.error || !workspaceQuery.data ? (
          <p className="mt-2 text-sm text-rose-600">
            Could not load your budget details. You can still submit a proposal.
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PersonalBudgetBars
                title="Joint Budget Tracker"
                allocated={workspaceQuery.data.personalBudget.jointAllocated}
                total={workspaceQuery.data.personalBudget.jointTarget}
              />
              <PersonalBudgetBars
                title="Discretionary Budget Tracker"
                allocated={workspaceQuery.data.personalBudget.discretionaryAllocated}
                total={workspaceQuery.data.personalBudget.discretionaryCap}
              />
            </div>
            <div className="mt-3 grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
              <p>Joint remaining: {currency(workspaceQuery.data.personalBudget.jointRemaining)}</p>
              <p>
                Discretionary remaining:{" "}
                {currency(workspaceQuery.data.personalBudget.discretionaryRemaining)}
              </p>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {proposalType === "joint"
                ? `Joint proposals use your joint voting allocation. You currently have ${currency(
                    workspaceQuery.data.personalBudget.jointRemaining
                  )} remaining.`
                : `Discretionary proposals count against your discretionary cap when approved. You currently have ${currency(
                    workspaceQuery.data.personalBudget.discretionaryRemaining
                  )} remaining.`}
            </p>
          </>
        )}
      </Card>

      <Card>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Proposal title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              list="proposal-title-suggestions"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              required
            />
            <datalist id="proposal-title-suggestions">
              {matchingTitleSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
              {title.trim() && !hasExactTitleSuggestion ? (
                <option
                  value={title.trim()}
                  label={`Add as a new proposal title: ${title.trim()}`}
                />
              ) : null}
            </datalist>
            <p className="mt-1 text-xs text-zinc-500">
              {titleSuggestionsQuery.isLoading
                ? "Loading previous proposal titles..."
                : !allTitleSuggestions.length
                ? "No previous proposal titles found. Enter a new proposal title."
                : title.trim() && !hasExactTitleSuggestion
                ? "No exact match found. Submitting will add this as a new proposal title."
                : "Suggestions are based on previous proposal titles in the database."}
            </p>
          </label>

          <label className="block text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 min-h-24 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            {proposalType === "joint" ? "Proposed total donation (joint)" : "Proposed amount"}
            <input
              type="number"
              min={0}
              max={proposalType === "discretionary" && discretionaryLimit !== null ? discretionaryLimit : undefined}
              value={proposedAmount}
              onChange={(event) => {
                const nextValue = event.target.value;

                if (proposalType === "discretionary" && discretionaryLimit !== null) {
                  const parsed = Number(nextValue);
                  if (Number.isFinite(parsed) && parsed > discretionaryLimit) {
                    setProposedAmount(String(discretionaryLimit));
                    return;
                  }
                }

                setProposedAmount(nextValue);
              }}
              className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              required
            />
            <p className="mt-1 text-xs text-zinc-500">
              {proposalType === "joint"
                ? "For joint proposals, this is the total donation you propose the family sends together."
                : discretionaryLimit !== null
                ? `Maximum allowed from your remaining discretionary budget: ${currency(discretionaryLimit)}.`
                : "This amount cannot exceed your remaining discretionary budget."}
            </p>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Proposal type
              <select
                value={proposalType}
                onChange={(event) => {
                  const nextType = event.target.value as "joint" | "discretionary";
                  setProposalType(nextType);

                  if (nextType === "discretionary" && discretionaryLimit !== null) {
                    setProposedAmount((current) => {
                      const parsedCurrent = Number(current);
                      if (!Number.isFinite(parsedCurrent) || parsedCurrent <= discretionaryLimit) {
                        return current;
                      }
                      return String(discretionaryLimit);
                    });
                  }
                }}
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              >
                <option value="joint">Joint (75% pool)</option>
                <option value="discretionary">Discretionary (25% pool)</option>
              </select>
            </label>

            <div className="block text-sm font-medium">
              Final amount rule
              <p className="mt-1 w-full rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300">
                {proposalType === "joint"
                  ? "Final amount is still the sum of blind allocations. Proposed amount is guidance only."
                  : "Final amount is set by the proposer's proposed amount."}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit Proposal"}
          </button>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </form>
      </Card>
    </div>
  );
}
