"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { currency, titleCase } from "@/lib/utils";
import { HistoricalImpactChart } from "@/components/dashboard/historical-impact-chart";
import { BudgetSplitChart } from "@/components/dashboard/budget-split-chart";
import { StatusPill } from "@/components/ui/status-pill";
import { FoundationSnapshot, ProposalStatus } from "@/lib/types";
import { VoteForm } from "@/components/voting/vote-form";

const STATUS_OPTIONS: ProposalStatus[] = ["to_review", "approved", "sent", "declined"];

type ProposalView = FoundationSnapshot["proposals"][number];

interface ProposalDraft {
  status: ProposalStatus;
  finalAmount: string;
  sentAt: string;
  notes: string;
}

type SortKey = "proposal" | "type" | "amount" | "status" | "sentAt" | "notes";
type SortDirection = "asc" | "desc";

interface TableFilters {
  proposal: string;
  proposalType: "all" | "joint" | "discretionary";
  amountMin: string;
  amountMax: string;
  status: "all" | ProposalStatus;
  sentAt: string;
  notes: string;
}

const DEFAULT_FILTERS: TableFilters = {
  proposal: "",
  proposalType: "all",
  amountMin: "",
  amountMax: "",
  status: "all",
  sentAt: "",
  notes: ""
};

const STATUS_RANK: Record<ProposalStatus, number> = {
  to_review: 0,
  approved: 1,
  sent: 2,
  declined: 3
};

function toAmountInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toProposalDraft(proposal: ProposalView): ProposalDraft {
  return {
    status: proposal.status,
    finalAmount: toAmountInput(proposal.progress.computedFinalAmount),
    sentAt: proposal.sentAt ?? "",
    notes: proposal.notes ?? ""
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProposalDraft>>({});
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("proposal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [savingProposalId, setSavingProposalId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<
    Record<string, { tone: "success" | "error"; text: string }>
  >({});

  const foundationKey = useMemo(() => {
    if (!user) {
      return null;
    }

    if (selectedYear === null) {
      return "/api/foundation";
    }

    return `/api/foundation?budgetYear=${selectedYear}`;
  }, [selectedYear, user]);

  const { data, isLoading, error, mutate } = useSWR<FoundationSnapshot>(foundationKey);

  const availableYears = useMemo(() => {
    if (!data) {
      return [];
    }

    const years = data.availableBudgetYears ?? [data.budget.year];
    return [...new Set(years)].sort((a, b) => b - a);
  }, [data]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (selectedYear === null || !availableYears.includes(selectedYear)) {
      setSelectedYear(data.budget.year);
    }
  }, [availableYears, data, selectedYear]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setDrafts(
      Object.fromEntries(data.proposals.map((proposal) => [proposal.id, toProposalDraft(proposal)]))
    );
  }, [data]);

  const filteredAndSortedProposals = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedProposalFilter = filters.proposal.trim().toLowerCase();
    const normalizedNotesFilter = filters.notes.trim().toLowerCase();
    const minAmount = Number(filters.amountMin);
    const maxAmount = Number(filters.amountMax);

    const filtered = data.proposals.filter((proposal) => {
      const searchableProposalText = `${proposal.title} ${proposal.description}`.toLowerCase();

      if (normalizedProposalFilter && !searchableProposalText.includes(normalizedProposalFilter)) {
        return false;
      }

      if (filters.proposalType !== "all" && proposal.proposalType !== filters.proposalType) {
        return false;
      }

      if (filters.status !== "all" && proposal.status !== filters.status) {
        return false;
      }

      if (filters.amountMin.trim() && Number.isFinite(minAmount)) {
        if (proposal.progress.computedFinalAmount < minAmount) {
          return false;
        }
      }

      if (filters.amountMax.trim() && Number.isFinite(maxAmount)) {
        if (proposal.progress.computedFinalAmount > maxAmount) {
          return false;
        }
      }

      if (filters.sentAt && (proposal.sentAt ?? "") !== filters.sentAt) {
        return false;
      }

      if (normalizedNotesFilter && !(proposal.notes ?? "").toLowerCase().includes(normalizedNotesFilter)) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "proposal") {
        comparison = a.title.localeCompare(b.title);
      } else if (sortKey === "type") {
        comparison = a.proposalType.localeCompare(b.proposalType);
      } else if (sortKey === "amount") {
        comparison = a.progress.computedFinalAmount - b.progress.computedFinalAmount;
      } else if (sortKey === "status") {
        comparison = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      } else if (sortKey === "sentAt") {
        comparison = (a.sentAt ?? "").localeCompare(b.sentAt ?? "");
      } else if (sortKey === "notes") {
        comparison = (a.notes ?? "").localeCompare(b.notes ?? "");
      }

      if (comparison === 0) {
        comparison = a.title.localeCompare(b.title);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [data, filters, sortDirection, sortKey]);

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
  const isHistoricalView =
    selectedYear !== null ? selectedYear < new Date().getFullYear() : data.budget.year < new Date().getFullYear();
  const canEditHistorical = Boolean(user?.role === "oversight" && isHistoricalView);
  const totalAllocatedForYear = data.budget.jointAllocated + data.budget.discretionaryAllocated;

  const setFilter = <K extends keyof TableFilters>(key: K, value: TableFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  };

  const sortMarker = (key: SortKey) => {
    if (sortKey !== key) {
      return "";
    }
    return sortDirection === "asc" ? " ^" : " v";
  };

  const updateDraft = (proposalId: string, patch: Partial<ProposalDraft>) => {
    setDrafts((current) => ({
      ...current,
      [proposalId]: {
        ...current[proposalId],
        ...patch
      }
    }));
    setRowMessage((current) => {
      if (!current[proposalId]) {
        return current;
      }

      const next = { ...current };
      delete next[proposalId];
      return next;
    });
  };

  const saveProposal = async (proposal: ProposalView, mode: "historical" | "sentDate") => {
    const draft = drafts[proposal.id];
    if (!draft) {
      return;
    }

    const payload: Record<string, unknown> = {};

    if (mode === "historical") {
      const finalAmount = Number(draft.finalAmount.replace(/[$,\s]+/g, ""));
      if (!Number.isFinite(finalAmount) || finalAmount < 0) {
        setRowMessage((current) => ({
          ...current,
          [proposal.id]: {
            tone: "error",
            text: "Final amount must be a non-negative number."
          }
        }));
        return;
      }

      payload.status = draft.status;
      payload.finalAmount = finalAmount;
      payload.notes = draft.notes;
      payload.sentAt =
        draft.status === "sent" && draft.sentAt.trim() ? draft.sentAt.trim() : null;
    } else {
      payload.sentAt = draft.sentAt.trim() ? draft.sentAt.trim() : null;
    }

    setSavingProposalId(proposal.id);
    setRowMessage((current) => {
      const next = { ...current };
      delete next[proposal.id];
      return next;
    });

    try {
      const response = await fetch(`/api/foundation/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const responseBody = await response.json().catch(() => ({} as Record<string, unknown>));

      if (!response.ok) {
        throw new Error(String(responseBody.error ?? "Failed to update proposal."));
      }

      const updatedProposal = responseBody.proposal as ProposalView | undefined;
      if (updatedProposal) {
        setDrafts((current) => ({
          ...current,
          [proposal.id]: toProposalDraft(updatedProposal)
        }));
      }

      setRowMessage((current) => ({
        ...current,
        [proposal.id]: {
          tone: "success",
          text: mode === "historical" ? "Historical proposal updated." : "Sent date updated."
        }
      }));

      await mutate();
    } catch (saveError) {
      setRowMessage((current) => ({
        ...current,
        [proposal.id]: {
          tone: "error",
          text:
            saveError instanceof Error ? saveError.message : "Failed to update proposal."
        }
      }));
    } finally {
      setSavingProposalId(null);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Annual Cycle</CardTitle>
            <CardValue>{data.budget.year} Master List Status</CardValue>
            <p className="mt-1 text-sm text-zinc-500">{data.annualCycle.monthHint}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Reset: {data.annualCycle.resetDate} | Year-end deadline: {data.annualCycle.yearEndDeadline}
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs font-semibold text-zinc-500">
              Budget year
              <select
                className="mt-1 block rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={String(selectedYear ?? data.budget.year)}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href="/proposals/new"
              className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> New Proposal
            </Link>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>TOTAL BUDGET</CardTitle>
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
          <CardTitle>TOTAL ALLOCATED</CardTitle>
          <CardValue>{currency(totalAllocatedForYear)}</CardValue>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>BUDGET SPLIT</CardTitle>
          <BudgetSplitChart joint={data.budget.jointPool} discretionary={data.budget.discretionaryPool} />
        </Card>
        <Card>
          <CardTitle>Historical Impact</CardTitle>
          <HistoricalImpactChart data={data.historyByYear} />
        </Card>
      </section>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Grant Tracker</CardTitle>
            <p className="text-xs text-zinc-500">Statuses: To Review, Approved, Sent, Declined</p>
          </div>
          <div className="flex items-center gap-2">
            {canEditHistorical ? (
              <p className="text-xs text-zinc-500">
                Oversight editing enabled for historical year {data.budget.year}.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] table-auto text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("proposal")}>
                    Proposal{sortMarker("proposal")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("type")}>
                    Type{sortMarker("type")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("amount")}>
                    Amount{sortMarker("amount")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("status")}>
                    Status{sortMarker("status")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("sentAt")}>
                    Date Amount Sent{sortMarker("sentAt")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("notes")}>
                    Notes{sortMarker("notes")}
                  </button>
                </th>
                <th className="px-2 py-2">Actions</th>
              </tr>
              <tr className="border-b text-xs text-zinc-500">
                <th className="px-2 py-2">
                  <input
                    type="text"
                    value={filters.proposal}
                    onChange={(event) => setFilter("proposal", event.target.value)}
                    placeholder="Filter text"
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </th>
                <th className="px-2 py-2">
                  <select
                    value={filters.proposalType}
                    onChange={(event) =>
                      setFilter("proposalType", event.target.value as TableFilters["proposalType"])
                    }
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="all">All</option>
                    <option value="joint">Joint</option>
                    <option value="discretionary">Discretionary</option>
                  </select>
                </th>
                <th className="px-2 py-2">
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={0}
                      value={filters.amountMin}
                      onChange={(event) => setFilter("amountMin", event.target.value)}
                      placeholder="Min"
                      className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <input
                      type="number"
                      min={0}
                      value={filters.amountMax}
                      onChange={(event) => setFilter("amountMax", event.target.value)}
                      placeholder="Max"
                      className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </th>
                <th className="px-2 py-2">
                  <select
                    value={filters.status}
                    onChange={(event) => setFilter("status", event.target.value as TableFilters["status"])}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="all">All</option>
                    {STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {titleCase(statusOption)}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2">
                  <input
                    type="date"
                    value={filters.sentAt}
                    onChange={(event) => setFilter("sentAt", event.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </th>
                <th className="px-2 py-2">
                  <input
                    type="text"
                    value={filters.notes}
                    onChange={(event) => setFilter("notes", event.target.value)}
                    placeholder="Filter notes"
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedProposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-zinc-500">
                    No proposals match the current filters for budget year {data.budget.year}.
                  </td>
                </tr>
              ) : (
                filteredAndSortedProposals.map((proposal) => {
                  const draft = drafts[proposal.id] ?? toProposalDraft(proposal);
                  const masked = proposal.progress.masked && proposal.status === "to_review";
                  const isOwnProposal = Boolean(user && proposal.proposerId === user.id);
                  const canEditSentDate = canEditHistorical || (isOwnProposal && proposal.status === "sent");
                  const sentDateDisabled = canEditHistorical ? draft.status !== "sent" : !canEditSentDate;
                  const rowState = rowMessage[proposal.id];

                  return (
                    <tr key={proposal.id} className="border-b align-top">
                      <td className="px-2 py-3">
                        <p className="font-semibold">{proposal.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{proposal.description}</p>
                      </td>
                      <td className="px-2 py-3 text-xs text-zinc-500">
                        {titleCase(proposal.proposalType)}
                      </td>
                      <td className="px-2 py-3 text-xs text-zinc-500">
                        {canEditHistorical ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={draft.finalAmount}
                            onChange={(event) =>
                              updateDraft(proposal.id, { finalAmount: event.target.value })
                            }
                            className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        ) : (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300">
                            {masked
                              ? "Blind until your vote is submitted"
                              : currency(proposal.progress.computedFinalAmount)}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {canEditHistorical ? (
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              updateDraft(proposal.id, {
                                status: event.target.value as ProposalStatus,
                                ...(event.target.value === "sent" ? {} : { sentAt: "" })
                              })
                            }
                            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {STATUS_OPTIONS.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {titleCase(statusOption)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusPill status={proposal.status} />
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {canEditSentDate ? (
                          <input
                            type="date"
                            value={draft.sentAt}
                            disabled={sentDateDisabled}
                            onChange={(event) =>
                              updateDraft(proposal.id, { sentAt: event.target.value })
                            }
                            className="w-36 rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        ) : (
                          <p className="text-xs text-zinc-500">{proposal.sentAt ?? "—"}</p>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {canEditHistorical ? (
                          <input
                            type="text"
                            value={draft.notes}
                            onChange={(event) => updateDraft(proposal.id, { notes: event.target.value })}
                            placeholder="Optional notes"
                            className="w-44 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        ) : (
                          <p className="max-w-44 text-xs text-zinc-500">
                            {proposal.notes?.trim() ? proposal.notes : "—"}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="space-y-2">
                          {canEditHistorical ? (
                            <button
                              type="button"
                              disabled={savingProposalId === proposal.id}
                              onClick={() => void saveProposal(proposal, "historical")}
                              className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {savingProposalId === proposal.id ? "Saving..." : "Save row"}
                            </button>
                          ) : isOwnProposal && proposal.status === "sent" ? (
                            <button
                              type="button"
                              disabled={savingProposalId === proposal.id}
                              onClick={() => void saveProposal(proposal, "sentDate")}
                              className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {savingProposalId === proposal.id ? "Saving..." : "Save date"}
                            </button>
                          ) : null}

                          {user &&
                          canVote &&
                          proposal.status === "to_review" &&
                          !proposal.progress.hasCurrentUserVoted ? (
                            <VoteForm
                              proposalId={proposal.id}
                              proposalType={proposal.proposalType}
                              proposedAmount={proposal.proposedAmount}
                              totalRequiredVotes={proposal.progress.totalRequiredVotes}
                              onSuccess={() => void mutate()}
                            />
                          ) : null}

                          {rowState ? (
                            <p
                              className={`text-xs ${
                                rowState.tone === "error"
                                  ? "text-rose-600"
                                  : "text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {rowState.text}
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
