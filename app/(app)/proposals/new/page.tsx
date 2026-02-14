"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency, parseNumberInput, titleCase } from "@/lib/utils";

interface ProposalTitleSuggestionsResponse {
  titles: string[];
}

type ProposalTypeOption = "" | "joint" | "discretionary";

export default function NewProposalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const workspaceQuery = useSWR<WorkspaceSnapshot>(
    user ? "/api/workspace" : null,
    { refreshInterval: 30_000 }
  );
  const titleSuggestionsQuery = useSWR<ProposalTitleSuggestionsResponse>(
    user ? "/api/proposals/titles" : null
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [charityNavigatorUrl, setCharityNavigatorUrl] = useState("");
  const [proposalType, setProposalType] = useState<ProposalTypeOption>("");
  const [proposedAmount, setProposedAmount] = useState("0");
  const [isTitleSuggestionsOpen, setIsTitleSuggestionsOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const parsedProposedAmount = parseNumberInput(proposedAmount);
  const allocationMode: "sum" = "sum";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discretionaryLimit = workspaceQuery.data
    ? Math.max(0, Math.floor(workspaceQuery.data.personalBudget.discretionaryRemaining))
    : null;
  const allTitleSuggestions = useMemo(() => titleSuggestionsQuery.data?.titles ?? [], [titleSuggestionsQuery.data?.titles]);
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
  const showCreateTitleOption = Boolean(title.trim()) && !hasExactTitleSuggestion;
  const hasAnyTitleSuggestions = matchingTitleSuggestions.length > 0 || showCreateTitleOption;
  const showTitleSuggestionsPanel = isTitleSuggestionsOpen && hasAnyTitleSuggestions;

  if (!user) {
    return null;
  }

  const confirmSubmit = async () => {
    if (!proposalType) {
      setError("Select a proposal type before submitting.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          website,
          charityNavigatorUrl,
          proposalType,
          allocationMode,
          proposedAmount: Number(proposedAmount || 0)
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to submit" }));
        throw new Error(payload.error || "Failed to submit");
      }

      setIsConfirmDialogOpen(false);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!proposalType) {
      setError("Select a proposal type before submitting.");
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="hidden rounded-3xl sm:block">
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
                : proposalType === "discretionary"
                ? `Discretionary proposals count against your discretionary cap when approved. You currently have ${currency(
                    workspaceQuery.data.personalBudget.discretionaryRemaining
                  )} remaining.`
                : "Select a proposal type to see how this proposal affects your budget."}
            </p>
          </>
        )}
      </Card>

      <Card>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Proposal title
            <div
              className="relative mt-1"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsTitleSuggestionsOpen(false);
                }
              }}
            >
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setIsTitleSuggestionsOpen(true);
                }}
                onFocus={() => setIsTitleSuggestionsOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsTitleSuggestionsOpen(false);
                  }
                }}
                autoComplete="off"
                className="w-full rounded-xl border bg-white/80 px-3 py-2 pr-12 dark:bg-zinc-900/40"
                required
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsTitleSuggestionsOpen((open) => !open)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl border-l bg-zinc-50 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Toggle proposal title suggestions"
                aria-expanded={showTitleSuggestionsPanel}
                aria-controls="proposal-title-suggestions-list"
              >
                <ChevronDown aria-hidden="true" size={16} />
              </button>
              {showTitleSuggestionsPanel ? (
                <div
                  id="proposal-title-suggestions-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {matchingTitleSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setTitle(suggestion);
                        setIsTitleSuggestionsOpen(false);
                      }}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                  {showCreateTitleOption ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setTitle(title.trim());
                        setIsTitleSuggestionsOpen(false);
                      }}
                      className="mt-1 block w-full rounded-lg border border-dashed border-zinc-300 px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Add as new title: {title.trim()}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {titleSuggestionsQuery.isLoading
                ? "Loading previous proposal titles..."
                : !allTitleSuggestions.length
                ? "No previous proposal titles found. Enter a new proposal title."
                : title.trim() && !hasExactTitleSuggestion
                ? "No exact match found. Submitting will add this as a new proposal title."
                : "Suggestions are based on previous proposal titles in the database. Use the arrow button to open suggestions."}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Proposal type
              <select
                value={proposalType}
                onChange={(event) => {
                  const nextType = event.target.value as ProposalTypeOption;
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
                required
              >
                <option value="" disabled>
                  Select
                </option>
                <option value="joint">Joint (75% pool)</option>
                <option value="discretionary">Discretionary (25% pool)</option>
              </select>
            </label>

            <div className="block text-sm font-medium">
              Final amount rule
              <p className="mt-1 w-full rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300">
                {proposalType === "joint"
                  ? "Final amount is still the sum of blind allocations. Proposed amount is guidance only."
                  : proposalType === "discretionary"
                  ? "Final amount is set by the proposer's proposed amount."
                  : "Select a proposal type to see the final amount rule."}
              </p>
            </div>
          </div>

          <label className="block text-sm font-medium">
            {proposalType === "joint"
              ? "Proposed total donation (joint)"
              : proposalType === "discretionary"
              ? "Proposed amount (discretionary)"
              : "Proposed amount"}
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
                : proposalType === "discretionary"
                ? discretionaryLimit !== null
                  ? `Maximum allowed from your remaining discretionary budget: ${currency(discretionaryLimit)}.`
                  : "This amount cannot exceed your remaining discretionary budget."
                : "Select a proposal type first so the correct amount rules apply."}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Amount preview: {parsedProposedAmount !== null ? currency(parsedProposedAmount) : "—"}
            </p>
          </label>

          <label className="block text-sm font-medium">
            Organization website link (optional)
            <input
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              placeholder="https://example.org"
              inputMode="url"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Add the organization website for proposal context and to help Brynn complete the
              donation.
            </p>
          </label>

          <label className="block text-sm font-medium">
            Charity Navigator link (optional)
            <input
              type="url"
              value={charityNavigatorUrl}
              onChange={(event) => setCharityNavigatorUrl(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              placeholder="https://www.charitynavigator.org/..."
              inputMode="url"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Add the Charity Navigator profile URL. A future update can auto-populate the score
              and summary from this link.
            </p>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !proposalType}
              className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit Proposal"}
            </button>
          </div>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </form>
      </Card>

      {isConfirmDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="proposal-submit-confirm-title"
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h2 id="proposal-submit-confirm-title" className="text-base font-semibold">
              Review Proposal Submission
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Confirm the details below before submitting this proposal.
            </p>

            <dl className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/60">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Title</dt>
                <dd className="text-right font-medium">{title.trim()}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Amount</dt>
                <dd className="text-right font-medium">
                  {currency(parsedProposedAmount ?? Number(proposedAmount || 0))}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Type</dt>
                <dd className="text-right font-medium">{titleCase(proposalType)}</dd>
              </div>
            </dl>

            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              <p className="font-medium text-zinc-700 dark:text-zinc-200">Immediate next steps:</p>
              <p className="mt-1">
                The proposal is added to the review queue, eligible family members are notified to
                vote, and it moves to meeting review once voting requirements are met.
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsConfirmDialogOpen(false)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmSubmit()}
                className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Confirm"}
              </button>
            </div>

            {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
