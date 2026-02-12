"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
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
  const canSubmitProposal = Boolean(user && ["member", "oversight", "manager"].includes(user.role));

  return (
    <div className="space-y-3 pb-4 sm:space-y-4">
      <Card className="rounded-3xl">
        <CardTitle>Mobile Focus</CardTitle>
        <CardValue>Today&apos;s Top Actions</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Action outstanding items, submit a proposal, and check your budget from one screen.
        </p>
      </Card>

      <Card>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <CardTitle>Outstanding Action Items</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              {workspace.actionItems.length === 0
                ? "No action items waiting right now."
                : `${workspace.actionItems.length} item${workspace.actionItems.length === 1 ? "" : "s"} waiting for your response.`}
            </p>
          </div>
          <Link
            href="/workspace"
            className="inline-flex min-h-10 items-center rounded-full border px-3 text-xs font-semibold"
          >
            Open queue
          </Link>
        </div>

        <div className="space-y-3">
          {visibleActionItems.length === 0 ? (
            <p className="text-sm text-zinc-500">You&apos;re all caught up.</p>
          ) : (
            visibleActionItems.map((item) => {
              const proposal = foundation.proposals.find((row) => row.id === item.proposalId);
              if (!proposal || !user) {
                return null;
              }

              return (
                <article key={item.proposalId} className="rounded-xl border p-3">
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
            className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-accent"
          >
            View {remainingActionItems} more action item{remainingActionItems === 1 ? "" : "s"}
          </Link>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Submit New Proposal</CardTitle>
        <p className="mt-1 text-sm text-zinc-500">
          Capture a new giving idea quickly, then continue in the full submission flow.
        </p>
        {canSubmitProposal ? (
          <Link
            href="/proposals/new"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Start new proposal <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            Proposal submission is available for member, oversight, and manager roles.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Personal Budget</CardTitle>
        <div className="mt-3 space-y-3">
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
        <div className="mt-3 grid gap-1 text-xs text-zinc-500">
          <p>Joint remaining: {currency(workspace.personalBudget.jointRemaining)}</p>
          <p>Discretionary remaining: {currency(workspace.personalBudget.discretionaryRemaining)}</p>
        </div>
      </Card>

      <Card className="rounded-2xl border-dashed">
        <CardTitle>Need Full Details?</CardTitle>
        <p className="mt-1 text-sm text-zinc-500">
          Open the complete tracker, reports, and historical details.
        </p>
        <Link
          href="/dashboard"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
        >
          View Full Details
        </Link>
      </Card>
    </div>
  );
}
