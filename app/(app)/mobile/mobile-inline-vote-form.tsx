"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import {
  VoteForm,
  VoteFormFooterButton,
  VoteFormProvider,
} from "@/components/voting/vote-form";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency, titleCase } from "@/lib/utils";

type ActionItem = WorkspaceSnapshot["actionItems"][number];

interface BudgetNumbers {
  totalIndividualAllocated: number;
  totalIndividualTarget: number;
  pendingJointTotal: number;
  pendingJointPortion: number;
  pendingDiscretionaryPortion: number;
  jointAllocated: number;
  jointTarget: number;
  discretionaryAllocated: number;
  discretionaryCap: number;
  totalBudgetRemaining: number;
}

interface MobileInlineVoteFormProps {
  item: ActionItem;
  expanded: boolean;
  isManager: boolean;
  budget: BudgetNumbers;
  userId: string;
  onSuccess: (proposalId: string) => void;
  onAllocationChange: (proposalId: string, amount: number) => void;
}

export function MobileInlineVoteForm({
  item,
  expanded,
  isManager,
  budget,
  userId,
  onSuccess,
  onAllocationChange,
}: MobileInlineVoteFormProps) {
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll the expanded form into view after the expand transition
  useEffect(() => {
    if (!expanded) {
      setBudgetExpanded(false);
      return;
    }
    const timer = setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 320); // wait for the 300ms grid-template-rows transition
    return () => clearTimeout(timer);
  }, [expanded]);

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      <div className="min-h-0 overflow-hidden">
        <div ref={containerRef} className="border-t border-border/60 pt-3">
          <VoteFormProvider
            variant="mobile"
            proposalId={item.proposalId}
            proposalType={item.proposalType}
            proposedAmount={item.proposedAmount}
            totalRequiredVotes={item.totalRequiredVotes}
            userId={userId}
            proposalTitle={item.title}
            onSuccess={() => onSuccess(item.proposalId)}
            onAllocationChange={
              item.proposalType === "joint"
                ? (amount) => onAllocationChange(item.proposalId, amount)
                : undefined
            }
            maxJointAllocation={
              item.proposalType === "joint" && !isManager
                ? budget.totalBudgetRemaining
                : undefined
            }
          >
            {/* Proposal metadata */}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-bold text-foreground">{item.title}</p>
              <Badge
                className={
                  item.proposalType === "joint"
                    ? "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    : "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }
              >
                {titleCase(item.proposalType)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              Proposed: {currency(item.proposedAmount)}
            </p>

            {/* Budget breakdown for joint proposals */}
            {item.proposalType === "joint" && !isManager ? (
              <div className="mt-2">
                <p className="text-sm font-medium text-foreground">
                  You have {currency(budget.totalBudgetRemaining)} remaining (joint + discretionary).
                </p>
                <button
                  type="button"
                  onClick={() => setBudgetExpanded((prev) => !prev)}
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-expanded={budgetExpanded}
                >
                  Your budget
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${budgetExpanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: budgetExpanded ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <PersonalBudgetBars
                        title="Total"
                        allocated={budget.totalIndividualAllocated - budget.pendingJointTotal}
                        total={budget.totalIndividualTarget}
                        pendingAllocation={budget.pendingJointTotal}
                        compact
                        emphasizeBorder
                      />
                      <PersonalBudgetBars
                        title="Joint"
                        allocated={budget.jointAllocated}
                        total={budget.jointTarget}
                        pendingAllocation={budget.pendingJointPortion}
                        compact
                      />
                      <PersonalBudgetBars
                        title="Discretionary"
                        allocated={budget.discretionaryAllocated}
                        total={budget.discretionaryCap}
                        pendingAllocation={budget.pendingDiscretionaryPortion}
                        compact
                      />
                      <p
                        className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
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
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Vote form */}
            <div className={item.proposalType === "joint" && !isManager ? "mt-3" : undefined}>
              <VoteForm
                proposalId={item.proposalId}
                proposalType={item.proposalType}
                proposedAmount={item.proposedAmount}
                totalRequiredVotes={item.totalRequiredVotes}
                userId={userId}
                proposalTitle={item.title}
                onSuccess={() => {}}
                onAllocationChange={undefined}
                maxJointAllocation={undefined}
                onSavingChange={() => {}}
              />
            </div>

            {/* Footer button */}
            <div className="mt-3 pb-1">
              <VoteFormFooterButton />
            </div>
          </VoteFormProvider>
        </div>
      </div>
    </div>
  );
}
