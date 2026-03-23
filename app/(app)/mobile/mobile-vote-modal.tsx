"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveModal,
  ResponsiveModalContent,
} from "@/components/ui/responsive-modal";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import {
  VoteForm,
  VoteFormFooterButton,
  VoteFormHeaderAmount,
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

interface MobileVoteModalProps {
  voteDialogItem: ActionItem | null;
  isManager: boolean;
  budget: BudgetNumbers;
  isVoteSaving: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: (proposalId: string) => void;
  onAllocationChange: (proposalId: string, amount: number) => void;
  onSavingChange: (saving: boolean) => void;
}

export function MobileVoteModal({
  voteDialogItem,
  isManager,
  budget,
  isVoteSaving,
  userId,
  onClose,
  onSuccess,
  onAllocationChange,
  onSavingChange,
}: MobileVoteModalProps) {
  const [budgetExpanded, setBudgetExpanded] = useState(false);

  return (
    <ResponsiveModal
      open={voteDialogItem !== null}
      onOpenChange={(open) => {
        if (!open) {
          if (isVoteSaving) return;
          setBudgetExpanded(false);
          onClose();
        }
      }}
      drawerProps={{ disablePreventScroll: false }}
    >
      {voteDialogItem ? (
        <VoteFormProvider
          variant="mobile"
          proposalId={voteDialogItem.proposalId}
          proposalType={voteDialogItem.proposalType}
          proposedAmount={voteDialogItem.proposedAmount}
          totalRequiredVotes={voteDialogItem.totalRequiredVotes}
          userId={userId}
          proposalTitle={voteDialogItem.title}
          onSuccess={() => onSuccess(voteDialogItem.proposalId)}
          onAllocationChange={
            voteDialogItem.proposalType === "joint"
              ? (amount) => onAllocationChange(voteDialogItem.proposalId, amount)
              : undefined
          }
          maxJointAllocation={
            voteDialogItem.proposalType === "joint" && !isManager
              ? budget.totalBudgetRemaining
              : undefined
          }
          onSavingChange={onSavingChange}
        >
          <ResponsiveModalContent
            dialogClassName="sm:max-w-md"
            showCloseButton={true}
            onInteractOutside={(e) => {
              if (isVoteSaving) e.preventDefault();
            }}
            footer={<VoteFormFooterButton />}
          >
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-bold">
                  {voteDialogItem.title}
                </DialogTitle>
                <Badge
                  className={
                    voteDialogItem.proposalType === "joint"
                      ? "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  }
                >
                  {titleCase(voteDialogItem.proposalType)}
                </Badge>
              </div>
              <VoteFormHeaderAmount proposedAmount={voteDialogItem.proposedAmount} />
            </DialogHeader>
            {voteDialogItem.proposalType === "joint" && !isManager ? (
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
                {budgetExpanded ? (
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
                ) : null}
              </div>
            ) : null}
            <div className={voteDialogItem.proposalType === "joint" && !isManager ? "mt-3" : undefined}>
              <VoteForm
                proposalId={voteDialogItem.proposalId}
                proposalType={voteDialogItem.proposalType}
                proposedAmount={voteDialogItem.proposedAmount}
                totalRequiredVotes={voteDialogItem.totalRequiredVotes}
                userId={userId}
                proposalTitle={voteDialogItem.title}
                onSuccess={() => {}}
                onAllocationChange={undefined}
                maxJointAllocation={undefined}
                onSavingChange={() => {}}
              />
            </div>
          </ResponsiveModalContent>
        </VoteFormProvider>
      ) : (
        <ResponsiveModalContent
          dialogClassName="sm:max-w-md"
          showCloseButton={true}
          onInteractOutside={(e) => {
            if (isVoteSaving) e.preventDefault();
          }}
        >
          {null}
        </ResponsiveModalContent>
      )}
    </ResponsiveModal>
  );
}
