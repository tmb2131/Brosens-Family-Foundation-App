"use client";

import Link from "next/link";
import { CheckCircle2, ListChecks, Plus, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { WorkspaceSnapshot } from "@/lib/types";
import { currency, titleCase } from "@/lib/utils";

type ActionItem = WorkspaceSnapshot["actionItems"][number];

interface MobileActionItemsProps {
  actionItems: ActionItem[];
  isManager: boolean;
  hasBudgetLeft: boolean;
  onVote: (proposalId: string) => void;
}

export function MobileActionItems({
  actionItems,
  isManager,
  hasBudgetLeft,
  onVote,
}: MobileActionItemsProps) {
  return (
    <GlassCard className="p-3" data-walkthrough="mobile-action-items">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <ListChecks className="h-4 w-4" />
            </span>
            <CardLabel>Outstanding Action Items</CardLabel>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {actionItems.length === 0
              ? "No action items waiting right now."
              : `${actionItems.length} item${actionItems.length === 1 ? "" : "s"} waiting for your response.`}
          </p>
        </div>
        {actionItems.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            {actionItems.length} open
          </span>
        )}
      </div>

      <div className="space-y-4">
        {actionItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">You&apos;re all caught up!</p>
            <p className="text-xs text-muted-foreground">No proposals need your vote right now.</p>
            {!isManager && hasBudgetLeft && (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/proposals/new">
                  <Plus className="h-4 w-4" />
                  Submit a Proposal
                </Link>
              </Button>
            )}
          </div>
        ) : (
          actionItems.map((item) => (
            <ActionItemCard key={item.proposalId} item={item} onVote={onVote} />
          ))
        )}
      </div>
    </GlassCard>
  );
}

function ActionItemCard({ item, onVote }: { item: ActionItem; onVote: (id: string) => void }) {
  return (
    <article
      className={`content-auto rounded-xl border border-t-2 bg-background p-4 shadow-sm ${
        item.proposalType === "joint"
          ? "border-t-indigo-400 dark:border-t-indigo-500"
          : "border-t-amber-400 dark:border-t-amber-500"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{item.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
        </div>
        <StatusPill status={item.status} />
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">
        {currency(item.proposedAmount)}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Type</span>
          <p className="font-medium text-foreground">{titleCase(item.proposalType)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Progress</span>
          <p className="font-medium text-foreground">{item.voteProgressLabel}</p>
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={() => onVote(item.proposalId)}>
        <Vote className="h-4 w-4" />{" "}
        {item.proposalType === "joint" ? "Enter vote & amount" : "Enter vote"}
      </Button>
    </article>
  );
}
