"use client";

import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { WorkspaceSnapshot, FoundationSnapshot } from "@/lib/types";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { PersonalBudgetBars } from "@/components/workspace/personal-budget-bars";
import { currency, titleCase, voteChoiceLabel } from "@/lib/utils";
import { VoteForm } from "@/components/voting/vote-form";
import { StatusPill } from "@/components/ui/status-pill";

export default function WorkspacePage() {
  const { user } = useAuth();

  const workspaceQuery = useSWR<WorkspaceSnapshot>(
    user ? "/api/workspace" : null,
    { refreshInterval: 30_000 }
  );
  const foundationQuery = useSWR<FoundationSnapshot>(
    user ? "/api/foundation" : null,
    { refreshInterval: 30_000 }
  );

  if (workspaceQuery.isLoading || foundationQuery.isLoading) {
    return <p className="text-sm text-zinc-500">Loading workspace...</p>;
  }

  if (workspaceQuery.error || foundationQuery.error || !workspaceQuery.data || !foundationQuery.data) {
    return (
      <p className="text-sm text-rose-600">
        Failed to load workspace data
        {workspaceQuery.error || foundationQuery.error
          ? `: ${(workspaceQuery.error || foundationQuery.error)?.message}`
          : "."}
      </p>
    );
  }

  const workspace = workspaceQuery.data;
  const foundation = foundationQuery.data;
  const totalIndividualAllocated =
    workspace.personalBudget.jointAllocated + workspace.personalBudget.discretionaryAllocated;
  const totalIndividualTarget = workspace.personalBudget.jointTarget + workspace.personalBudget.discretionaryCap;

  return (
    <div className="space-y-4 pb-4">
      <section className="grid gap-3 xl:grid-cols-[2fr_1fr]">
        <Card className="rounded-3xl">
          <CardTitle>My Workspace</CardTitle>
          <CardValue>{workspace.user.name}</CardValue>
          <p className="mt-1 text-sm text-zinc-500">
            Track your joint/discretionary balances, action items, and personal voting history.
          </p>
        </Card>
        <PersonalBudgetBars
          title="Total Individual Budget Tracker"
          allocated={totalIndividualAllocated}
          total={totalIndividualTarget}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
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
      </section>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Action Items</CardTitle>
          <Link href="/dashboard" className="inline-flex min-h-10 items-center text-xs font-semibold text-accent">
            Open full tracker
          </Link>
        </div>

        <div className="space-y-3">
          {workspace.actionItems.length === 0 ? (
            <p className="text-sm text-zinc-500">No vote-required items right now.</p>
          ) : (
            workspace.actionItems.map((item) => {
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
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Personal History</CardTitle>
          <div className="mt-3 space-y-2">
            {workspace.voteHistory.map((vote) => (
              <div key={`${vote.proposalId}-${vote.at}`} className="rounded-xl border p-2">
                <p className="text-sm font-medium">{vote.proposalTitle}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {voteChoiceLabel(vote.choice)} | {currency(vote.amount)}
                </p>
                <p className="text-xs text-zinc-500">{new Date(vote.at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>My Submitted Gifts</CardTitle>
          <div className="mt-3 space-y-2">
            {workspace.submittedGifts.length === 0 ? (
              <p className="text-sm text-zinc-500">No submitted gifts yet.</p>
            ) : (
              workspace.submittedGifts.map((proposal) => (
                <div key={proposal.id} className="rounded-xl border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{proposal.title}</p>
                    <StatusPill status={proposal.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Budget Year: {proposal.budgetYear}</p>
                  <p className="text-xs text-zinc-500">Amount: {currency(proposal.proposedAmount)}</p>
                  <p className="mt-1 text-xs text-zinc-500">{proposal.description}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
