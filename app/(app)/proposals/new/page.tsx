"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AlertCircle, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal";
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

  const [organizationName, setOrganizationName] = useState("");
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
  const allTitleSuggestions = useMemo(
    () => titleSuggestionsQuery.data?.titles ?? [],
    [titleSuggestionsQuery.data?.titles]
  );
  const normalizedOrganizationName = organizationName.trim().toLowerCase();
  const matchingTitleSuggestions = useMemo(() => {
    if (!allTitleSuggestions.length) {
      return [];
    }

    if (!normalizedOrganizationName) {
      return allTitleSuggestions.slice(0, 12);
    }

    const startsWithMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const suggestion of allTitleSuggestions) {
      const normalizedSuggestion = suggestion.trim().toLowerCase();
      if (!normalizedSuggestion.includes(normalizedOrganizationName)) {
        continue;
      }

      if (normalizedSuggestion.startsWith(normalizedOrganizationName)) {
        startsWithMatches.push(suggestion);
      } else {
        containsMatches.push(suggestion);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 12);
  }, [allTitleSuggestions, normalizedOrganizationName]);
  const hasExactTitleSuggestion = normalizedOrganizationName
    ? allTitleSuggestions.some(
        (suggestion) => suggestion.trim().toLowerCase() === normalizedOrganizationName
      )
    : false;
  const showCreateTitleOption = Boolean(organizationName.trim()) && !hasExactTitleSuggestion;
  const hasAnyTitleSuggestions = matchingTitleSuggestions.length > 0 || showCreateTitleOption;
  const showTitleSuggestionsPanel = isTitleSuggestionsOpen && hasAnyTitleSuggestions;
  const isManager = user?.role === "manager";

  useEffect(() => {
    if (isManager && proposalType !== "joint") {
      setProposalType("joint");
    }
  }, [isManager, proposalType]);

  if (!user) {
    return null;
  }

  const confirmSubmit = async () => {
    if (!proposalType) {
      setError("Select a proposal type before submitting.");
      return;
    }

    if (isManager && proposalType !== "joint") {
      setError("Managers can only submit joint proposals.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationName,
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

      void globalMutate("/api/navigation/summary");
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
    if (isManager && proposalType !== "joint") {
      setError("Managers can only submit joint proposals.");
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const budgetCardContent = (
    <>
      <CardLabel>{isManager ? "Your Budget Access" : "Your Individual Budget"}</CardLabel>
      {workspaceQuery.isLoading ? (
        <p className="mt-2 text-sm text-zinc-500">Loading budget details...</p>
      ) : workspaceQuery.error || !workspaceQuery.data ? (
        <p className="mt-2 text-sm text-rose-600">
          Could not load your budget details. You can still submit a proposal.
        </p>
      ) : isManager ? (
        <p className="mt-2 text-sm text-zinc-500">
          Managers do not have an individual budget. Manager profiles can submit joint proposals only.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
          <div className="mt-3 grid gap-1 text-xs text-zinc-500 sm:grid-cols-2 lg:grid-cols-1">
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
    </>
  );

  return (
    <div className="page-stack pb-4">
      <GlassCard className="hidden rounded-3xl sm:block">
        <CardLabel>Submission Flow</CardLabel>
        <CardValue>New Giving Idea</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <span className="status-dot bg-emerald-500" />
          Proposals are added to the full grant list and move to blind voting by eligible voters.
        </p>
      </GlassCard>

      <GlassCard className="lg:hidden">{budgetCardContent}</GlassCard>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
      <GlassCard>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Organization name
            <div
              className="relative mt-1 flex rounded-xl border border-zinc-300 shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-[hsl(var(--accent)/0.45)] focus-within:shadow-[0_0_0_2px_hsl(var(--accent)/0.22)] dark:border-zinc-700"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsTitleSuggestionsOpen(false);
                }
              }}
            >
              <input
                value={organizationName}
                onChange={(event) => {
                  setOrganizationName(event.target.value);
                  setIsTitleSuggestionsOpen(true);
                }}
                onFocus={() => setIsTitleSuggestionsOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsTitleSuggestionsOpen(false);
                  }
                }}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-l-xl border-none bg-white px-2 py-2 text-sm text-zinc-900 shadow-none outline-none dark:bg-zinc-900 dark:text-zinc-100"
                required
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsTitleSuggestionsOpen((open) => !open)}
                className="flex w-10 shrink-0 items-center justify-center rounded-r-xl border-l border-zinc-300 bg-zinc-50 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Toggle organization name suggestions"
                aria-expanded={showTitleSuggestionsPanel}
                aria-controls="organization-name-suggestions-list"
              >
                <ChevronDown aria-hidden="true" size={16} />
              </button>
              {showTitleSuggestionsPanel ? (
                <div
                  id="organization-name-suggestions-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {matchingTitleSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setOrganizationName(suggestion);
                        setIsTitleSuggestionsOpen(false);
                      }}
                      className="block w-full rounded-lg px-2 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                  {showCreateTitleOption ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setOrganizationName(organizationName.trim());
                        setIsTitleSuggestionsOpen(false);
                      }}
                      className="mt-1 block w-full rounded-lg border border-dashed border-zinc-300 px-2 py-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Add as new organization: {organizationName.trim()}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {titleSuggestionsQuery.isLoading
                ? "Loading known organization names..."
                : !allTitleSuggestions.length
                ? "No organization names found yet. Enter a new organization name."
                : organizationName.trim() && !hasExactTitleSuggestion
                ? "No exact match found. Submitting will add this as a new organization name."
                : "Suggestions are based on organization names in the database. Use the arrow button to open suggestions."}
            </p>
          </label>

          <label className="block text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field-control mt-1 min-h-24 w-full rounded-xl"
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
                  if (isManager && nextType !== "joint") {
                    setProposalType("joint");
                    return;
                  }
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
                className="field-control mt-1 w-full rounded-xl"
                disabled={isManager}
                required
              >
                {isManager ? (
                  <option value="joint">Joint (75% pool)</option>
                ) : (
                  <>
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="joint">Joint (75% pool)</option>
                    <option value="discretionary">Discretionary (25% pool)</option>
                  </>
                )}
              </select>
              {isManager ? (
                <p className="mt-1 text-xs text-zinc-500">Managers can submit joint proposals only.</p>
              ) : null}
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
              onFocus={(event) => {
                if (event.target.value === "0") {
                  setProposedAmount("");
                }
              }}
              onBlur={(event) => {
                if (event.target.value === "") {
                  setProposedAmount("0");
                }
              }}
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
              className="field-control field-control--no-spinner mt-1 w-full rounded-xl"
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
              className="field-control mt-1 w-full rounded-xl"
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
              className="field-control mt-1 w-full rounded-xl"
              placeholder="https://www.charitynavigator.org/..."
              inputMode="url"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Add the Charity Navigator profile URL. A future update can auto-populate the score
              and summary from this link.
            </p>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              size="lg"
              type="button"
              disabled={saving}
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Cancel
            </Button>
            <Button
              size="lg"
              type="submit"
              disabled={saving || !proposalType || (isManager && proposalType !== "joint")}
              className="w-full"
            >
              {saving ? "Submitting..." : "Submit Proposal"}
            </Button>
          </div>

          {error ? (
            <div className="error-message-box">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </form>
      </GlassCard>

      <div className="hidden lg:block">
        <div className="lg:sticky lg:top-6">
          <GlassCard>{budgetCardContent}</GlassCard>
        </div>
      </div>
      </div>

      {isConfirmDialogOpen ? (
        <ModalOverlay
          onClose={() => setIsConfirmDialogOpen(false)}
          closeOnBackdrop={!saving}
          className="z-50 items-center justify-center px-4 py-6"
        >
          <ModalPanel aria-labelledby="proposal-submit-confirm-title" className="max-w-lg rounded-3xl p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="proposal-submit-confirm-title" className="text-lg font-bold">
                Review Proposal Submission
              </h2>
              {proposalType ? (
                <Badge
                  className={
                    proposalType === "joint"
                      ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
                      : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
                  }
                >
                  {titleCase(proposalType)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Confirm the details below before submitting this proposal.
            </p>

            <dl className="mt-4 grid gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/40">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Organization
                </dt>
                <dd className="text-right font-medium">{organizationName.trim()}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Amount
                </dt>
                <dd className="text-right text-base font-bold">
                  {currency(parsedProposedAmount ?? Number(proposedAmount || 0))}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Type
                </dt>
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

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                size="lg"
                type="button"
                disabled={saving}
                onClick={() => setIsConfirmDialogOpen(false)}
                className="w-full"
              >
                Go Back
              </Button>
              <Button
                size="lg"
                type="button"
                disabled={saving}
                onClick={() => void confirmSubmit()}
                className="w-full"
              >
                {saving ? "Submitting..." : "Confirm"}
              </Button>
            </div>

            {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
          </ModalPanel>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
