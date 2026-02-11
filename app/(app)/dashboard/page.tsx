"use client";

import Link from "next/link";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { currency, titleCase } from "@/lib/utils";
import { HistoricalImpactChart } from "@/components/dashboard/historical-impact-chart";
import { BudgetSplitChart } from "@/components/dashboard/budget-split-chart";
import { StatusPill } from "@/components/ui/status-pill";
import { FoundationSnapshot } from "@/lib/types";
import { VoteForm } from "@/components/voting/vote-form";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error, mutate } = useSWR<FoundationSnapshot>(
    user ? "/api/foundation" : null,
    { refreshInterval: 10_000 }
  );

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading foundation dashboard...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-sm text-rose-600">
        Failed to load dashboard{error ? `: ${error.message}` : "."}
      </p>
    );
  }

  const canVote = Boolean(user && ["member", "oversight"].includes(user.role));

  return (
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Annual Cycle</CardTitle>
            <CardValue>{data.budget.year} Master List Status</CardValue>
            <p className="mt-1 text-sm text-zinc-500">{data.annualCycle.monthHint}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Reset: {data.annualCycle.resetDate} | Year-end deadline: {data.annualCycle.yearEndDeadline}
            </p>
          </div>
          <Link
            href="/proposals/new"
            className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> New Proposal
          </Link>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Total Fund (incl. roll-over)</CardTitle>
          <CardValue>{currency(data.budget.total)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Joint Pool Remaining</CardTitle>
          <CardValue>{currency(data.budget.jointRemaining)}</CardValue>
          <p className="mt-1 text-xs text-zinc-500">Allocated: {currency(data.budget.jointAllocated)}</p>
        </Card>
        <Card>
          <CardTitle>Discretionary Remaining</CardTitle>
          <CardValue>{currency(data.budget.discretionaryRemaining)}</CardValue>
          <p className="mt-1 text-xs text-zinc-500">
            Allocated: {currency(data.budget.discretionaryAllocated)}
          </p>
        </Card>
        <Card>
          <CardTitle>Carry-over from Previous Year</CardTitle>
          <CardValue>{currency(data.budget.rolloverFromPreviousYear)}</CardValue>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>75/25 Budget Split</CardTitle>
          <BudgetSplitChart joint={data.budget.jointPool} discretionary={data.budget.discretionaryPool} />
        </Card>
        <Card>
          <CardTitle>Historical Impact</CardTitle>
          <HistoricalImpactChart data={data.historyByYear} />
        </Card>
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Grant Tracker</CardTitle>
          <p className="text-xs text-zinc-500">Statuses: To Review, Approved, Sent, Declined</p>
        </div>

        <div className="space-y-3">
          {data.proposals.map((proposal) => {
            const masked = proposal.progress.masked && proposal.status === "to_review";
            return (
              <article key={proposal.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{proposal.title}</h3>
                    <p className="text-xs text-zinc-500">{proposal.organizationName}</p>
                  </div>
                  <StatusPill status={proposal.status} />
                </div>

                <p className="mt-2 text-sm">{proposal.description}</p>
                <div className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                  <p>Type: {titleCase(proposal.proposalType)}</p>
                  <p>
                    Voting mode: {titleCase(proposal.allocationMode)} | {proposal.progress.votesSubmitted} of {" "}
                    {proposal.progress.totalRequiredVotes} votes in
                  </p>
                  <p>
                    Proposed amount: {masked ? "Blind until your vote is submitted" : currency(proposal.progress.computedFinalAmount)}
                  </p>
                </div>

                {user && canVote && proposal.status === "to_review" && !proposal.progress.hasCurrentUserVoted ? (
                  <VoteForm
                    proposalId={proposal.id}
                    proposalType={proposal.proposalType}
                    onSuccess={() => void mutate()}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
