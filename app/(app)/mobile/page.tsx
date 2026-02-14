"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ListChecks, Wallet } from "lucide-react";
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
  const searchParams = useSearchParams();
  const workspaceQuery = useSWR<WorkspaceSnapshot>(user ? "/api/workspace" : null, {
    refreshInterval: 30_000
  });
  const foundationQuery = useSWR<FoundationSnapshot>(user ? "/api/foundation" : null, {
    refreshInterval: 30_000
  });
  const deepLinkTarget = useMemo(() => {
    const value = searchParams.get("next")?.trim() ?? "";
    if (!value.startsWith("/") || value.startsWith("//")) {
      return null;
    }
    return value;
  }, [searchParams]);

  if (workspaceQuery.isLoading || foundationQuery.isLoading) {
    return <p className="text-sm text-zinc-500">Loading your mobile focus view...</p>;
  }

  if (workspaceQuery.error || foundationQuery.error || !workspaceQuery.data || !foundationQuery.data) {
    return (
      <div className="page-stack pb-4">
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
    <div className="page-stack pb-4">
      {deepLinkTarget ? (
        <Card className="p-3">
          <p className="text-xs text-zinc-500">Continue to the required action from your email.</p>
          <Link
            href={deepLinkTarget}
            className="mt-2 inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Continue to required action
          </Link>
        </Card>
      ) : null}

      <Card className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <ListChecks className="h-4 w-4" />
              </span>
              <CardTitle>Outstanding Action Items</CardTitle>
            </div>
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
                <article
                  key={item.proposalId}
                  className={`rounded-xl border border-t-2 p-4 ${
                    item.proposalType === "joint"
                      ? "border-t-indigo-400 dark:border-t-indigo-500"
                      : "border-t-amber-400 dark:border-t-amber-500"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{proposal.description}</p>
                    </div>
                    <StatusPill status={proposal.status} />
                  </div>
                  <p className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                    {currency(proposal.proposedAmount)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500">Type</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">
                        {titleCase(item.proposalType)}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500">Progress</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">
                        {item.voteProgressLabel}
                      </p>
                    </div>
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
                  <Link
                    href="/dashboard"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-zinc-200 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    View Details
                  </Link>
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
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Wallet className="h-4 w-4" />
          </span>
          <CardTitle>Personal Budget</CardTitle>
        </div>
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
