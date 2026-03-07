"use client";

import Link from "next/link";
import { FileText, Lightbulb, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel } from "@/components/ui/card";
import { currency } from "@/lib/utils";

interface MobileNudgeCardProps {
  noSubmissionThisYear: boolean;
  hasBudgetLeft: boolean;
  budgetRemaining: number;
  isManager: boolean;
}

export function MobileNudgeCard({
  noSubmissionThisYear,
  hasBudgetLeft,
  budgetRemaining,
  isManager,
}: MobileNudgeCardProps) {
  if (!noSubmissionThisYear && !hasBudgetLeft) return null;

  return (
    <GlassCard className="p-3" data-walkthrough="mobile-nudge">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <Lightbulb className="h-4 w-4" />
        </span>
        <CardLabel>Quick Tips</CardLabel>
      </div>
      <div className="mt-3 space-y-2.5">
        {noSubmissionThisYear && (
          <div className="flex items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">
              You haven&apos;t submitted a proposal this year.
            </p>
          </div>
        )}
        {hasBudgetLeft && (
          <div className="flex items-start gap-2.5">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">
              You have <span className="font-semibold text-foreground">{currency(budgetRemaining)}</span> budget remaining.
            </p>
          </div>
        )}
      </div>
      {noSubmissionThisYear && !isManager && (
        <Button asChild size="sm" className="mt-3 w-full" variant="outline">
          <Link href="/proposals/new">
            <Plus className="h-4 w-4" />
            Submit a Proposal
          </Link>
        </Button>
      )}
    </GlassCard>
  );
}
