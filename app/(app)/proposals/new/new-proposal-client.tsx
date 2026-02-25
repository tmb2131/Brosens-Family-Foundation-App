"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { AlertCircle, ChevronDown, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { Textarea } from "@/components/ui/textarea";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency, parseNumberInput, titleCase } from "@/lib/utils";
import { getClientIsMobile } from "@/lib/device-detection";

interface ProposalTitleSuggestionsResponse {
  titles: string[];
}

type ProposalTypeOption = "" | "joint" | "discretionary";

export default function NewProposalClient() {
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
  const [proposerAllocationAmount, setProposerAllocationAmount] = useState("");
  const [isTitleSuggestionsOpen, setIsTitleSuggestionsOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const parsedProposedAmount = parseNumberInput(proposedAmount);
  const parsedProposerAllocation = parseNumberInput(proposerAllocationAmount);
  const allocationMode: "sum" = "sum";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const isVotingMember = user?.role === "member" || user?.role === "oversight";
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
  const isManager = user?.role === "manager" || user?.role === "admin";

  const jointRemaining = workspaceQuery.data?.personalBudget.jointRemaining ?? 0;
  const discretionaryRemaining = workspaceQuery.data?.personalBudget.discretionaryRemaining ?? 0;
  const totalBudgetRemaining = jointRemaining + discretionaryRemaining;
  const jointAllocationFromProposer =
    proposalType === "joint" && isVotingMember
      ? Math.max(0, parsedProposerAllocation ?? parseNumberInput(proposerAllocationAmount) ?? 0)
      : 0;
  const jointPortionOfProposerAllocation = Math.min(jointAllocationFromProposer, jointRemaining);
  const discretionaryPortionOfProposerAllocation = Math.max(
    0,
    jointAllocationFromProposer - jointRemaining
  );
  const discretionaryProposedPending =
    proposalType === "discretionary"
      ? Math.max(0, parsedProposedAmount ?? parseNumberInput(proposedAmount) ?? 0)
      : 0;

  const jointAllocatedPreview =
    workspaceQuery.data && proposalType === "joint" && isVotingMember
      ? workspaceQuery.data.personalBudget.jointAllocated + jointPortionOfProposerAllocation
      : workspaceQuery.data?.personalBudget.jointAllocated ?? 0;
  const jointRemainingPreview =
    workspaceQuery.data && proposalType === "joint" && isVotingMember
      ? Math.max(0, workspaceQuery.data.personalBudget.jointTarget - jointAllocatedPreview)
      : workspaceQuery.data?.personalBudget.jointRemaining ?? 0;

  const discretionaryAllocatedPreview =
    workspaceQuery.data && proposalType === "discretionary"
      ? workspaceQuery.data.personalBudget.discretionaryAllocated +
        Math.max(0, parsedProposedAmount ?? parseNumberInput(proposedAmount) ?? 0)
      : workspaceQuery.data && proposalType === "joint" && isVotingMember
        ? workspaceQuery.data.personalBudget.discretionaryAllocated +
          discretionaryPortionOfProposerAllocation
        : workspaceQuery.data?.personalBudget.discretionaryAllocated ?? 0;
  const discretionaryRemainingPreview =
    workspaceQuery.data && proposalType === "discretionary"
      ? Math.max(0, workspaceQuery.data.personalBudget.discretionaryCap - discretionaryAllocatedPreview)
      : workspaceQuery.data && proposalType === "joint" && isVotingMember
        ? Math.max(
            0,
            workspaceQuery.data.personalBudget.discretionaryCap - discretionaryAllocatedPreview
          )
        : workspaceQuery.data?.personalBudget.discretionaryRemaining ?? 0;

  useEffect(() => {
    if (isManager && proposalType !== "joint") {
      setProposalType("joint");
    }
  }, [isManager, proposalType]);

  if (!user) {
    return null;
  }

  const confirmSubmit = async () => {
    if (savingRef.current) return;

    if (!proposalType) {
      setError("Select a proposal type before submitting.");
      return;
    }

    if (isManager && proposalType !== "joint") {
      setError("Managers can only submit joint proposals.");
      return;
    }

    savingRef.current = true;
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

      const { proposal } = (await response.json()) as { proposal: { id: string } };
      if (proposalType === "joint" && isVotingMember && proposal?.id) {
        const allocation =
          parsedProposerAllocation ?? parseNumberInput(proposerAllocationAmount) ?? 0;
        const voteResponse = await fetch("/api/votes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            proposalId: proposal.id,
            choice: "yes",
            allocationAmount: Math.max(0, Math.round(allocation))
          })
        });
        if (!voteResponse.ok) {
          const payload = await voteResponse.json().catch(() => ({ error: "Could not save your vote" }));
          throw new Error(payload.error || "Proposal was created but your vote could not be saved. You can vote from the dashboard or workspace.");
        }
      }

      void globalMutate("/api/navigation/summary");
      void globalMutate("/api/workspace");
      mutateAllFoundation();
      setIsConfirmDialogOpen(false);
      window.dispatchEvent(new Event("route-progress-start"));
      router.push(getClientIsMobile() ? "/mobile" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      savingRef.current = false;
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
    if (proposalType === "joint" && isVotingMember) {
      const allocation = parsedProposerAllocation ?? parseNumberInput(proposerAllocationAmount);
      if (allocation === null || !Number.isFinite(allocation) || allocation < 0) {
        setError("Enter your allocation for this joint proposal.");
        return;
      }
      const maxAllocation = workspaceQuery.data
        ? workspaceQuery.data.personalBudget.jointRemaining +
          workspaceQuery.data.personalBudget.discretionaryRemaining
        : Infinity;
      if (allocation > maxAllocation) {
        setError(
          `Your allocation cannot exceed your total budget remaining (${currency(maxAllocation)}).`
        );
        return;
      }
    }
    setIsConfirmDialogOpen(true);
  };

  const budgetCardContent = (
    <>
      <CardLabel>{isManager ? "Your Budget Access" : "Your Individual Budget"}</CardLabel>
      {workspaceQuery.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading budget details...</p>
      ) : workspaceQuery.error || !workspaceQuery.data ? (
        <p className="mt-2 text-sm text-rose-600">
          Could not load your budget details. You can still submit a proposal.
        </p>
      ) : isManager ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Managers do not have an individual budget. Manager profiles can submit joint proposals only.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <PersonalBudgetBars
              title="Joint Budget"
              allocated={workspaceQuery.data.personalBudget.jointAllocated}
              total={workspaceQuery.data.personalBudget.jointTarget}
              pendingAllocation={jointPortionOfProposerAllocation}
            />
            <PersonalBudgetBars
              title="Discretionary Budget"
              allocated={workspaceQuery.data.personalBudget.discretionaryAllocated}
              total={workspaceQuery.data.personalBudget.discretionaryCap}
              pendingAllocation={
                proposalType === "joint"
                  ? discretionaryPortionOfProposerAllocation
                  : discretionaryProposedPending
              }
            />
          </div>
          <p
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
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
          <p className="mt-2 text-xs text-muted-foreground">
            {proposalType === "joint"
              ? `Your allocation uses joint budget first, then discretionary (max ${currency(
                  totalBudgetRemaining
                )} total).${proposalType === "joint" && isVotingMember && (parsedProposerAllocation ?? 0) > 0 ? ` After this allocation: ${currency(jointRemainingPreview)} joint, ${currency(discretionaryRemainingPreview)} discretionary remaining.` : ""}`
              : proposalType === "discretionary"
              ? `Discretionary proposals count against your discretionary cap when approved. You currently have ${currency(
                  discretionaryRemainingPreview
                )} remaining${(parsedProposedAmount ?? 0) > 0 ? " after this proposal" : ""}.`
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
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Proposals are added to the full grant list and move to blind voting by eligible voters.
        </p>
      </GlassCard>

      <GlassCard className="p-3 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Wallet className="h-4 w-4" />
          </span>
          <CardLabel>Personal Budget</CardLabel>
        </div>
        {workspaceQuery.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading budget details...</p>
        ) : workspaceQuery.error || !workspaceQuery.data ? (
          <p className="mt-2 text-sm text-rose-600">
            Could not load your budget details. You can still submit a proposal.
          </p>
        ) : isManager ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Managers do not have an individual budget. Manager profiles can submit joint proposals only.
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <PersonalBudgetBars
                title="Total"
                allocated={
                  workspaceQuery.data.personalBudget.jointAllocated +
                  workspaceQuery.data.personalBudget.discretionaryAllocated
                }
                total={
                  workspaceQuery.data.personalBudget.jointTarget +
                  workspaceQuery.data.personalBudget.discretionaryCap
                }
                pendingAllocation={
                  proposalType === "joint"
                    ? jointAllocationFromProposer
                    : discretionaryProposedPending
                }
                compact
              />
              <PersonalBudgetBars
                title="Joint"
                allocated={workspaceQuery.data.personalBudget.jointAllocated}
                total={workspaceQuery.data.personalBudget.jointTarget}
                pendingAllocation={jointPortionOfProposerAllocation}
                compact
              />
              <PersonalBudgetBars
                title="Discretionary"
                allocated={workspaceQuery.data.personalBudget.discretionaryAllocated}
                total={workspaceQuery.data.personalBudget.discretionaryCap}
                pendingAllocation={
                  proposalType === "joint"
                    ? discretionaryPortionOfProposerAllocation
                    : discretionaryProposedPending
                }
                compact
              />
            </div>
            <p
              className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
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
            <p className="mt-2 text-xs text-muted-foreground">
              {proposalType === "joint"
                ? `Your allocation uses joint budget first, then discretionary (max ${currency(
                    totalBudgetRemaining
                  )} total).${proposalType === "joint" && isVotingMember && (parsedProposerAllocation ?? 0) > 0 ? ` After this allocation: ${currency(jointRemainingPreview)} joint, ${currency(discretionaryRemainingPreview)} discretionary remaining.` : ""}`
                : proposalType === "discretionary"
                ? `Discretionary proposals count against your discretionary cap when approved. You currently have ${currency(
                    discretionaryRemainingPreview
                  )} remaining${(parsedProposedAmount ?? 0) > 0 ? " after this proposal" : ""}.`
                : "Select a proposal type to see how this proposal affects your budget."}
            </p>
          </>
        )}
      </GlassCard>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
      <GlassCard>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Organization name
            <div
              className="relative mt-1 flex rounded-xl border border-input shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-[hsl(var(--accent)/0.45)] focus-within:shadow-[0_0_0_2px_hsl(var(--accent)/0.22)]"
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
                className="min-w-0 flex-1 rounded-l-xl border-none bg-transparent px-2 py-2 text-sm text-foreground shadow-none outline-none"
                required
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsTitleSuggestionsOpen((open) => !open)}
                className="flex w-10 shrink-0 items-center justify-center rounded-r-xl border-l border-input bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
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
                  className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
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
                      className="block w-full rounded-lg px-2 py-2.5 text-left text-sm text-foreground hover:bg-muted"
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
                      className="mt-1 block w-full rounded-lg border border-dashed border-border px-2 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
                    >
                      Add as new organization: {organizationName.trim()}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {titleSuggestionsQuery.isLoading
                ? "Loading known organization names..."
                : !allTitleSuggestions.length
                ? "No organization names found yet. Enter a new organization name."
                : organizationName.trim() && !hasExactTitleSuggestion
                ? "No exact match found. Submitting will add this as a new organization name."
                : "Suggestions are based on organization names in the database. Use the arrow button to open suggestions."}
            </p>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="proposal-description">Description</Label>
            <Textarea
              id="proposal-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 rounded-xl"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-type">Proposal type</Label>
              <select
                id="proposal-type"
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
                className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-xl border px-3 py-1 text-base outline-none disabled:opacity-50 md:text-sm"
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
                <p className="mt-1 text-xs text-muted-foreground">Managers can submit joint proposals only.</p>
              ) : null}
            </div>

            <div className="block text-sm font-medium">
              Final amount rule
              <p className="mt-1 w-full rounded-xl border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {proposalType === "joint"
                  ? "Final amount is still the sum of blind allocations. Proposed amount is guidance only."
                  : proposalType === "discretionary"
                  ? "Final amount is set by the proposer's proposed amount."
                  : "Select a proposal type to see the final amount rule."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proposed-amount">
              {proposalType === "joint"
                ? "Proposed total donation (joint)"
                : proposalType === "discretionary"
                ? "Proposed amount (discretionary)"
                : "Proposed amount"}
            </Label>
            <AmountInput
              id="proposed-amount"
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
              className="rounded-xl [appearance:textfield] [&::-webkit-inner-spin-button]:[-webkit-appearance:none] [&::-webkit-outer-spin-button]:[-webkit-appearance:none]"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {proposalType === "joint"
                ? "For joint proposals, this is the total donation you propose the family sends together."
                : proposalType === "discretionary"
                ? discretionaryLimit !== null
                  ? `Maximum allowed from your remaining discretionary budget: ${currency(discretionaryLimit)}.`
                  : "This amount cannot exceed your remaining discretionary budget."
                : "Select a proposal type first so the correct amount rules apply."}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Amount preview: {parsedProposedAmount !== null ? currency(parsedProposedAmount) : "—"}
            </p>
          </div>

          {proposalType === "joint" && isVotingMember ? (
            <div className="space-y-1.5">
              <Label htmlFor="proposer-allocation">Your allocation</Label>
              {workspaceQuery.data && workspaceQuery.data.votingMemberCount > 0 ? (
                <p className="text-[11px] italic text-muted-foreground">
                  Your implied share:{" "}
                  {parsedProposedAmount != null && Number.isFinite(parsedProposedAmount)
                    ? currency(
                        Math.round(
                          parsedProposedAmount / workspaceQuery.data.votingMemberCount
                        )
                      )
                    : "—"}{" "}
                  each (based on proposed total).
                </p>
              ) : null}
              <AmountInput
                id="proposer-allocation"
                min={0}
                max={workspaceQuery.data ? totalBudgetRemaining : undefined}
                value={proposerAllocationAmount}
                onFocus={(event) => {
                  if (event.target.value === "0") {
                    setProposerAllocationAmount("");
                  }
                }}
                onBlur={(event) => {
                  if (event.target.value === "") {
                    setProposerAllocationAmount("0");
                  }
                }}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (workspaceQuery.data && totalBudgetRemaining < Infinity) {
                    const parsed = Number(nextValue);
                    if (Number.isFinite(parsed) && parsed > totalBudgetRemaining) {
                      setProposerAllocationAmount(String(totalBudgetRemaining));
                      return;
                    }
                  }
                  setProposerAllocationAmount(nextValue);
                }}
                className="rounded-xl [appearance:textfield] [&::-webkit-inner-spin-button]:[-webkit-appearance:none] [&::-webkit-outer-spin-button]:[-webkit-appearance:none]"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                First uses your joint remaining, then discretionary. Submitting will automatically
                record your vote as &quot;yes&quot; with this allocation.
              </p>
              {workspaceQuery.data ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Total budget remaining: {currency(jointRemainingPreview + discretionaryRemainingPreview)}{" "}
                  (joint: {currency(jointRemainingPreview)}, discretionary:{" "}
                  {currency(discretionaryRemainingPreview)})
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="org-website">Organization website link (optional)</Label>
            <Input
              id="org-website"
              type="text"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="rounded-xl"
              placeholder="e.g. prepforprep.org or https://example.org"
              inputMode="url"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Add the organization website for proposal context and to help Brynn complete the
              donation.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="charity-nav-url">Charity Navigator link (optional)</Label>
            <Input
              id="charity-nav-url"
              type="text"
              value={charityNavigatorUrl}
              onChange={(event) => setCharityNavigatorUrl(event.target.value)}
              className="rounded-xl"
              placeholder="e.g. charitynavigator.org/... or full URL"
              inputMode="url"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Add the Charity Navigator profile URL. The app auto-populates the score and summary
              from this link.
            </p>
          </div>

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
              disabled={
                saving ||
                !proposalType ||
                (isManager && proposalType !== "joint") ||
                (proposalType === "joint" &&
                  isVotingMember &&
                  (parsedProposerAllocation === null ||
                    !Number.isFinite(parsedProposerAllocation) ||
                    parsedProposerAllocation < 0 ||
                    (workspaceQuery.data != null &&
                      parsedProposerAllocation > totalBudgetRemaining)))
              }
              className="w-full"
            >
              {saving ? "Submitting..." : "Submit Proposal"}
            </Button>
          </div>

          {error ? (
            <div role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
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

      <ResponsiveModal
        open={isConfirmDialogOpen}
        onOpenChange={(open) => { if (!open && !saving) setIsConfirmDialogOpen(false); }}
      >
        <ResponsiveModalContent
          aria-labelledby="proposal-submit-confirm-title"
          dialogClassName="max-w-lg rounded-3xl p-5"
          showCloseButton={false}
          onInteractOutside={(e) => { if (saving) e.preventDefault(); }}
        >
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
            <p className="mt-2 text-sm text-muted-foreground">
              Confirm the details below before submitting this proposal.
            </p>

            <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-muted/60 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Organization
                </dt>
                <dd className="text-right font-medium">{organizationName.trim()}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount
                </dt>
                <dd className="text-right text-base font-bold">
                  {currency(parsedProposedAmount ?? Number(proposedAmount || 0))}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </dt>
                <dd className="text-right font-medium">{titleCase(proposalType)}</dd>
              </div>
              {proposalType === "joint" && isVotingMember ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Your allocation
                  </dt>
                  <dd className="text-right font-medium">
                    {currency(
                      (parsedProposerAllocation ?? parseNumberInput(proposerAllocationAmount)) ?? 0
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Immediate next steps:</p>
              <p className="mt-1">
                {proposalType === "joint"
                  ? "The proposal is added to the review queue; eligible family members are notified to vote, and it moves to meeting review once voting requirements are met."
                  : "The proposal is added to the review queue; eligible family members are notified to acknowledge, and it moves to meeting review once everyone has acknowledged the donation."}
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

            {error ? <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p> : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
