"use client";

import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { VoteForm } from "@/components/voting/vote-form";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { FoundationSnapshot, WorkspaceSnapshot } from "@/lib/types";
import { currency, titleCase } from "@/lib/utils";

const ACTION_ITEMS_PREVIEW_LIMIT = 2;

export default function MobileFocusPage() {
  const { user } = useAuth();
  const workspaceQuery = useSWR<WorkspaceSnapshot>(user ? "/api/workspace" : null, {
    refreshInterval: 10_000
  });
  const foundationQuery = useSWR<FoundationSnapshot>(user ? "/api/foundation" : null, {
    refreshInterval: 10_000
  });

  if (workspaceQuery.isLoading || foundationQuery.isLoading) {
    return <p className="text-sm text-zinc-500">Loading your mobile focus view...</p>;
  }

  if (workspaceQuery.error || foundationQuery.error || !workspaceQuery.data || !foundationQuery.data) {
    return (
      <div className="space-y-3 pb-4">
        <p className="text-sm text-rose-600">
          Could not load the focus view
          {workspaceQuery.error || foundationQuery.error
            ? `: ${(workspaceQuery.error || foundationQuery.error)?.message}`
            : "."}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
        >
          View Full Details
        </Link>
      </div>
    );
  }

  const workspace = workspaceQuery.data;
  const foundation = foundationQuery.data;
  const visibleActionItems = workspace.actionItems.slice(0, ACTION_ITEMS_PREVIEW_LIMIT);
  const remainingActionItems = Math.max(0, workspace.actionItems.length - visibleActionItems.length);

  return (
    <div className="space-y-2 pb-3 sm:space-y-3">
      <Card className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <CardTitle>Outstanding Action Items</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              {workspace.actionItems.length === 0
                ? "No action items waiting right now."
                : `${workspace.actionItems.length} item${workspace.actionItems.length === 1 ? "" : "s"} waiting for your response.`}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-zinc-600">
            {workspace.actionItems.length} open
          </span>
        </div>

        <div className="space-y-2">
          {visibleActionItems.length === 0 ? (
            <p className="text-sm text-zinc-500">You&apos;re all caught up.</p>
          ) : (
            visibleActionItems.map((item) => {
              const proposal = foundation.proposals.find((row) => row.id === item.proposalId);
              if (!proposal || !user) {
                return null;
              }

              return (
                <article key={item.proposalId} className="rounded-lg border p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="text-xs text-zinc-500">
                        {titleCase(item.proposalType)} | {item.voteProgressLabel}
                      </p>
                    </div>
                    <StatusPill status={proposal.status} />
                  </div>
                  <VoteForm
                    proposalId={item.proposalId}
                    proposalType={item.proposalType}
                    proposedAmount={proposal.proposedAmount}
                    totalRequiredVotes={proposal.progress.totalRequiredVotes}
                    onSuccess={() => {
                      void workspaceQuery.mutate();
                      void foundationQuery.mutate();
                    }}
                  />
                </article>
              );
            })
          )}
        </div>

        {remainingActionItems > 0 ? (
          <Link
            href="/workspace"
            className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-accent"
          >
            View {remainingActionItems} more action item{remainingActionItems === 1 ? "" : "s"}
          </Link>
        ) : null}
      </Card>

      <Card className="p-3">
        <CardTitle>Personal Budget</CardTitle>
        <div className="mt-2 space-y-2">
          <PersonalBudgetBars
            title="Joint Budget Tracker"
            allocated={workspace.personalBudget.jointAllocated}
            total={workspace.personalBudget.jointTarget}
          />
          <PersonalBudgetBars
            title="Discretionary Budget Tracker"
            allocated={workspace.personalBudget.discretionaryAllocated}
            total={workspace.personalBudget.discretionaryCap}
          />
        </div>
        <div className="mt-2 grid gap-1 text-xs text-zinc-500">
          <p>Joint remaining: {currency(workspace.personalBudget.jointRemaining)}</p>
          <p>Discretionary remaining: {currency(workspace.personalBudget.discretionaryRemaining)}</p>
        </div>
      </Card>
    </div>
  );
}
