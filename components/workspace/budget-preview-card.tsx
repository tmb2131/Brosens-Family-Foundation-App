"use client";

import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { CardLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { currency } from "@/lib/utils";

interface BudgetPreviewData {
  jointAllocated: number;
  jointTarget: number;
  jointRemaining: number;
  discretionaryAllocated: number;
  discretionaryCap: number;
  discretionaryRemaining: number;
}

interface BudgetPreviewCardProps {
  variant: "sidebar" | "compact";
  budget: BudgetPreviewData | undefined;
  isLoading: boolean;
  hasError: boolean;
  isManager: boolean;
  proposalType: "" | "joint" | "discretionary";
  isVotingMember: boolean;
  jointPortionOfProposerAllocation: number;
  discretionaryPortionOfProposerAllocation: number;
  discretionaryProposedPending: number;
  jointAllocationFromProposer: number;
  totalBudgetRemaining: number;
  jointRemainingPreview: number;
  discretionaryRemainingPreview: number;
  parsedProposerAllocation: number | null;
  parsedProposedAmount: number | null;
}

export function BudgetPreviewCard({
  variant,
  budget,
  isLoading,
  hasError,
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
}: BudgetPreviewCardProps) {
  if (isLoading) {
    return (
      <div className="mt-2 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  if (hasError || !budget) {
    return (
      <p className="mt-2 text-sm text-rose-600">
        Could not load your budget details. You can still submit a proposal.
      </p>
    );
  }

  if (isManager) {
    return (
      <>
        {variant === "sidebar" && (
          <CardLabel>Your Budget Access</CardLabel>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Managers do not have an individual budget. Manager profiles can submit joint proposals only.
        </p>
      </>
    );
  }

  const budgetExplanation =
    proposalType === "joint"
      ? `Your allocation uses joint budget first, then discretionary (max ${currency(
          totalBudgetRemaining
        )} total).${
          proposalType === "joint" && isVotingMember && (parsedProposerAllocation ?? 0) > 0
            ? ` After this allocation: ${currency(jointRemainingPreview)} joint, ${currency(
                discretionaryRemainingPreview
              )} discretionary remaining.`
            : ""
        }`
      : proposalType === "discretionary"
        ? `Discretionary proposals count against your discretionary cap when approved. You currently have ${currency(
            discretionaryRemainingPreview
          )} remaining${(parsedProposedAmount ?? 0) > 0 ? " after this proposal" : ""}.`
        : "Select a proposal type to see how this proposal affects your budget.";

  if (variant === "compact") {
    return (
      <>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <PersonalBudgetBars
            title="Total"
            allocated={budget.jointAllocated + budget.discretionaryAllocated}
            total={budget.jointTarget + budget.discretionaryCap}
            pendingAllocation={
              proposalType === "joint" ? jointAllocationFromProposer : discretionaryProposedPending
            }
            compact
          />
          <PersonalBudgetBars
            title="Joint"
            allocated={budget.jointAllocated}
            total={budget.jointTarget}
            pendingAllocation={jointPortionOfProposerAllocation}
            compact
          />
          <PersonalBudgetBars
            title="Discretionary"
            allocated={budget.discretionaryAllocated}
            total={budget.discretionaryCap}
            pendingAllocation={
              proposalType === "joint"
                ? discretionaryPortionOfProposerAllocation
                : discretionaryProposedPending
            }
            compact
          />
        </div>
        <BudgetLegend />
        <p className="mt-2 text-xs text-muted-foreground">{budgetExplanation}</p>
      </>
    );
  }

  return (
    <>
      <CardLabel>{isManager ? "Your Budget Access" : "Your Individual Budget"}</CardLabel>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <PersonalBudgetBars
          title="Joint Budget"
          allocated={budget.jointAllocated}
          total={budget.jointTarget}
          pendingAllocation={jointPortionOfProposerAllocation}
        />
        <PersonalBudgetBars
          title="Discretionary Budget"
          allocated={budget.discretionaryAllocated}
          total={budget.discretionaryCap}
          pendingAllocation={
            proposalType === "joint"
              ? discretionaryPortionOfProposerAllocation
              : discretionaryProposedPending
          }
        />
      </div>
      <BudgetLegend />
      <p className="mt-2 text-xs text-muted-foreground">{budgetExplanation}</p>
    </>
  );
}

function BudgetLegend() {
  return (
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
  );
}
