"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { AmountInput } from "@/components/ui/amount-input";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BudgetPreviewCard } from "@/components/workspace/budget-preview-card";
import { useDraftPersistence, type ProposalDraft } from "@/lib/hooks/use-draft-persistence";
import { UserProfile, WorkspaceSnapshot } from "@/lib/types";
import { currency, parseNumberInput, titleCase } from "@/lib/utils";
import { getClientIsMobile } from "@/lib/device-detection";
import { usePagePerf } from "@/lib/perf-logger-client";

const CharityGivingHistory = dynamic(
  () =>
    import("@/components/charity-giving-history").then((mod) => mod.CharityGivingHistory),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 p-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-24 w-full animate-pulse rounded bg-muted" />
      </div>
    )
  }
);

interface ProposalTitleSuggestionsResponse {
  titles: string[];
}

type CharityNavigatorPreviewState =
  | "preview_available"
  | "missing_ein"
  | "no_score"
  | "config_missing"
  | "upstream_error";

interface CharityNavigatorPreviewResponse {
  state: CharityNavigatorPreviewState;
  normalizedUrl: string | null;
  ein: string | null;
  score: number | null;
  organizationName: string | null;
  message?: string;
}

type ProposalTypeOption = "" | "joint" | "discretionary";

interface NewProposalClientProps {
  profile: UserProfile;
  initialWorkspace: WorkspaceSnapshot;
  initialTitleSuggestions: string[];
}

export default function NewProposalClient({ profile, initialWorkspace, initialTitleSuggestions }: NewProposalClientProps) {
  const router = useRouter();
  const workspaceQuery = useSWR<WorkspaceSnapshot>("/api/workspace", {
    refreshInterval: 30_000,
    fallbackData: initialWorkspace,
    revalidateOnMount: false,
    revalidateIfStale: false
  });
  const titleSuggestionsQuery = useSWR<ProposalTitleSuggestionsResponse>("/api/proposals/titles", {
    fallbackData: { titles: initialTitleSuggestions },
    revalidateOnMount: false,
    revalidateIfStale: false
  });

  usePagePerf("/proposals/new", !workspaceQuery.isLoading, {
    isLoading: workspaceQuery.isLoading,
    hasData: workspaceQuery.data !== undefined,
    error: workspaceQuery.error?.message ?? null,
  });

  const [organizationName, setOrganizationName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [charityNavigatorUrl, setCharityNavigatorUrl] = useState("");
  const [proposalType, setProposalType] = useState<ProposalTypeOption>("");
  const [proposedAmount, setProposedAmount] = useState("0");
  const [proposerAllocationAmount, setProposerAllocationAmount] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<CharityNavigatorPreviewResponse | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const parsedProposedAmount = parseNumberInput(proposedAmount);
  const parsedProposerAllocation = parseNumberInput(proposerAllocationAmount);
  const allocationMode: "sum" = "sum";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const isVotingMember = profile.role === "member" || profile.role === "oversight";
  const discretionaryLimit = workspaceQuery.data
    ? Math.max(0, Math.floor(workspaceQuery.data.personalBudget.discretionaryRemaining))
    : null;
  const allTitleSuggestions = useMemo(
    () => titleSuggestionsQuery.data?.titles ?? [],
    [titleSuggestionsQuery.data?.titles]
  );
  const normalizedOrganizationName = organizationName.trim().toLowerCase();
  const hasExactTitleSuggestion = normalizedOrganizationName
    ? allTitleSuggestions.some(
        (suggestion) => suggestion.trim().toLowerCase() === normalizedOrganizationName
      )
    : false;
  const isManager = profile.role === "manager" || profile.role === "admin";

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

  const jointRemainingPreview =
    workspaceQuery.data && proposalType === "joint" && isVotingMember
      ? Math.max(
          0,
          workspaceQuery.data.personalBudget.jointTarget -
            (workspaceQuery.data.personalBudget.jointAllocated + jointPortionOfProposerAllocation)
        )
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
    workspaceQuery.data
      ? Math.max(
          0,
          workspaceQuery.data.personalBudget.discretionaryCap - discretionaryAllocatedPreview
        )
      : 0;

  // --- Draft persistence ---
  const getValues = useCallback(
    (): Omit<ProposalDraft, "savedAt"> => ({
      organizationName,
      description,
      website,
      charityNavigatorUrl,
      proposalType,
      proposedAmount,
      proposerAllocationAmount
    }),
    [organizationName, description, website, charityNavigatorUrl, proposalType, proposedAmount, proposerAllocationAmount]
  );
  const setValues = useCallback((draft: ProposalDraft) => {
    setOrganizationName(draft.organizationName);
    setDescription(draft.description);
    setWebsite(draft.website);
    setCharityNavigatorUrl(draft.charityNavigatorUrl);
    if (draft.proposalType === "joint" || draft.proposalType === "discretionary") {
      setProposalType(draft.proposalType);
    }
    setProposedAmount(draft.proposedAmount || "0");
    setProposerAllocationAmount(draft.proposerAllocationAmount);
  }, []);
  const { saveDraft, clearDraft } = useDraftPersistence({ getValues, setValues });

  useEffect(() => {
    saveDraft();
  }, [organizationName, description, website, charityNavigatorUrl, proposalType, proposedAmount, proposerAllocationAmount, saveDraft]);

  // --- Progress indicator ---
  const requiredFields = useMemo(() => {
    const fields = [
      Boolean(organizationName.trim()),
      Boolean(description.trim()),
      Boolean(proposalType),
      parsedProposedAmount !== null && parsedProposedAmount > 0
    ];
    if (proposalType === "joint" && isVotingMember) {
      fields.push(
        parsedProposerAllocation !== null && parsedProposerAllocation > 0
      );
    }
    return fields;
  }, [organizationName, description, proposalType, parsedProposedAmount, isVotingMember, parsedProposerAllocation]);

  const formProgress = useMemo(() => {
    const completed = requiredFields.filter(Boolean).length;
    return Math.round((completed / requiredFields.length) * 100);
  }, [requiredFields]);

  useEffect(() => {
    if (isManager && proposalType !== "joint") {
      setProposalType("joint");
    }
  }, [isManager, proposalType]);

  const previewCharityNavigator = async () => {
    if (!charityNavigatorUrl.trim() || isPreviewLoading) {
      return;
    }

    setPreviewError(null);
    setPreviewResult(null);
    setIsPreviewLoading(true);

    try {
      const response = await fetch("/api/charity-navigator/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ charityNavigatorUrl })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to preview link" }));
        throw new Error(payload.error || "Failed to preview link");
      }

      const payload = (await response.json()) as CharityNavigatorPreviewResponse;
      setPreviewResult(payload);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to preview link");
    } finally {
      setIsPreviewLoading(false);
    }
  };


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

      clearDraft();
      void globalMutate("/api/navigation/summary");
      void globalMutate("/api/workspace");
      mutateAllFoundation();
      setIsConfirmDialogOpen(false);
      window.dispatchEvent(new Event("route-progress-start"));
      router.push(getClientIsMobile() ? "/mobile" : "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
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

  const budgetProps = {
    budget: workspaceQuery.data?.personalBudget,
    isLoading: workspaceQuery.isLoading,
    hasError: Boolean(workspaceQuery.error) || !workspaceQuery.data,
    isManager,
    proposalType,
    isVotingMember,
    jointPortionOfProposerAllocation,
    discretionaryPortionOfProposerAllocation,
    discretionaryProposedPending,
    jointAllocationFromProposer,
    totalBudgetRemaining,
    jointRemainingPreview,
    discretionaryRemainingPreview,
    parsedProposerAllocation,
    parsedProposedAmount
  } as const;

  const givingHistoryOrgName =
    previewResult?.state === "preview_available" && previewResult.organizationName?.trim()
      ? previewResult.organizationName.trim()
      : organizationName.trim() || null;

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 px-4 pb-2 pt-2 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-3">
          <Progress
            value={formProgress}
            className="h-1.5"
            indicatorClassName="bg-accent transition-all duration-300"
          />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formProgress}%
          </span>
        </div>
      </div>

      <div className="page-stack pt-2 pb-4">
      <GlassCard className="hidden rounded-3xl sm:block">
        <CardLabel>Submission Flow</CardLabel>
        <CardValue>New Giving Idea</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Proposals are added to the full grant list and move to blind voting by eligible voters.
        </p>
      </GlassCard>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
      <GlassCard>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Organization name
            <AutocompleteInput
              value={organizationName}
              onChange={setOrganizationName}
              suggestions={allTitleSuggestions}
              addNewLabel="Add as new organization"
              className="mt-1"
              required
            />
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
              <Select
                value={proposalType}
                onValueChange={(value) => {
                  const nextType = value as ProposalTypeOption;
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
                disabled={isManager}
                required
              >
                <SelectTrigger id="proposal-type" className="rounded-xl">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="joint">Joint (75% pool)</SelectItem>
                  {!isManager && (
                    <SelectItem value="discretionary">Discretionary (25% pool)</SelectItem>
                  )}
                </SelectContent>
              </Select>
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
            {proposalType !== "" && (parsedProposedAmount ?? 0) === 0 ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Proposed amount is $0.
              </p>
            ) : null}
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
              {(parsedProposerAllocation ?? 0) === 0 ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Your allocation is $0.
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
            <div className="flex items-center gap-2">
              <Input
                id="charity-nav-url"
                type="text"
                value={charityNavigatorUrl}
                onChange={(event) => {
                  setCharityNavigatorUrl(event.target.value);
                  setPreviewError(null);
                  setPreviewResult(null);
                }}
                className="rounded-xl"
                placeholder="e.g. charitynavigator.org/ein/#########"
                inputMode="url"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-xl"
                disabled={isPreviewLoading || !charityNavigatorUrl.trim()}
                onClick={() => void previewCharityNavigator()}
              >
                {isPreviewLoading ? "Previewing..." : "Preview"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the Charity Navigator profile URL. The app auto-populates the score from this
              link when you submit.
            </p>
            {previewError ? (
              <p className="mt-1 text-xs text-rose-600">{previewError}</p>
            ) : null}
            {previewResult?.state === "preview_available" ? (
              <div className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                {previewResult.organizationName?.trim()
                  ? `${previewResult.organizationName.trim()}'s score preview: `
                  : "This charity's score preview: "}
                {previewResult.score ?? "—"} / 100
                {previewResult.ein ? ` (EIN ${previewResult.ein})` : ""}
              </div>
            ) : null}
            {previewResult && previewResult.state !== "preview_available" ? (
              <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                {previewResult.message ?? "Preview unavailable for this link."}
              </div>
            ) : null}
          </div>

          {/* Giving history for the selected / previewed organization */}
          {givingHistoryOrgName ? (
            <CollapsibleSection title="Past giving history" className="rounded-2xl">
              <CharityGivingHistory charityName={givingHistoryOrgName} fuzzy primarySource="children" showSourceToggle={false} />
            </CollapsibleSection>
          ) : null}

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
          <GlassCard>
            <BudgetPreviewCard variant="sidebar" {...budgetProps} />
          </GlassCard>
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
                <dd className="flex items-center justify-end gap-1.5 text-right text-base font-bold">
                  {(parsedProposedAmount ?? Number(proposedAmount || 0)) === 0 && (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
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
                  <dd className="flex items-center justify-end gap-1.5 text-right font-medium">
                    {((parsedProposerAllocation ?? parseNumberInput(proposerAllocationAmount)) ?? 0) === 0 && (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
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
    </>
  );
}
