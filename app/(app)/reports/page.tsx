"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Download } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { FoundationSnapshot, ProposalStatus } from "@/lib/types";
import { currency, titleCase } from "@/lib/utils";
import { chartPalette, chartText } from "@/lib/chart-styles";

const STATUS_OPTIONS: ProposalStatus[] = ["to_review", "approved", "sent", "declined"];
const STATUS_COLORS: Record<ProposalStatus, string> = {
  to_review: "#0EA5E9",
  approved: "#10B981",
  sent: "#6366F1",
  declined: "#F43F5E"
};

type StatusFilterState = Record<ProposalStatus, boolean>;

const DEFAULT_STATUS_FILTERS: StatusFilterState = {
  to_review: true,
  approved: true,
  sent: true,
  declined: true
};

function sumAmount(rows: FoundationSnapshot["proposals"]) {
  return rows.reduce((sum, row) => sum + row.progress.computedFinalAmount, 0);
}

function compactCurrency(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return currency(value);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [statusFilters, setStatusFilters] = useState<StatusFilterState>(DEFAULT_STATUS_FILTERS);

  const canAccess = user ? user.role === "oversight" || user.role === "manager" : false;

  const foundationKey = useMemo(() => {
    if (!canAccess) {
      return null;
    }

    if (selectedYear === null) {
      return "/api/foundation";
    }

    return `/api/foundation?budgetYear=${selectedYear}`;
  }, [canAccess, selectedYear]);

  const { data, isLoading, error } = useSWR<FoundationSnapshot>(foundationKey);

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

  const activeStatuses = useMemo(
    () => STATUS_OPTIONS.filter((status) => statusFilters[status]),
    [statusFilters]
  );

  const filteredProposals = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.proposals
      .filter((proposal) => statusFilters[proposal.status])
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data, statusFilters]);

  const statusCounts = useMemo(
    () =>
      STATUS_OPTIONS.map((status) => ({
        status,
        label: titleCase(status),
        count: filteredProposals.filter((proposal) => proposal.status === status).length
      })),
    [filteredProposals]
  );

  const typeSplit = useMemo(() => {
    const joint = filteredProposals
      .filter((proposal) => proposal.proposalType === "joint")
      .reduce((sum, proposal) => sum + proposal.progress.computedFinalAmount, 0);
    const discretionary = filteredProposals
      .filter((proposal) => proposal.proposalType === "discretionary")
      .reduce((sum, proposal) => sum + proposal.progress.computedFinalAmount, 0);
    return [
      { name: "Joint", value: joint, color: chartPalette.joint },
      { name: "Discretionary", value: discretionary, color: chartPalette.discretionary }
    ];
  }, [filteredProposals]);

  const totalAmount = useMemo(() => sumAmount(filteredProposals), [filteredProposals]);
  const sentAmount = useMemo(
    () => sumAmount(filteredProposals.filter((proposal) => proposal.status === "sent")),
    [filteredProposals]
  );
  const approvedAmount = useMemo(
    () => sumAmount(filteredProposals.filter((proposal) => proposal.status === "approved")),
    [filteredProposals]
  );

  const toggleStatus = (status: ProposalStatus) => {
    setStatusFilters((current) => {
      const activeCount = STATUS_OPTIONS.filter((item) => current[item]).length;
      if (current[status] && activeCount === 1) {
        return current;
      }
      return { ...current, [status]: !current[status] };
    });
  };

  const exportToPdf = () => {
    if (!data) {
      return;
    }

    const previousTitle = document.title;
    const statusLabel = activeStatuses.map((status) => titleCase(status)).join(", ");
    document.title = `Foundation Report ${data.budget.year} - ${statusLabel || "No Statuses"}`;
    window.print();
    setTimeout(() => {
      document.title = previousTitle;
    }, 200);
  };

  if (!user) {
    return <p className="text-sm text-zinc-500">Loading secure report view...</p>;
  }

  if (!canAccess) {
    return (
      <Card>
        <CardTitle>Reports</CardTitle>
        <p className="mt-2 text-sm text-rose-600">
          This page is available only to Oversight and Manager users.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading annual report...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-sm text-rose-600">
        Failed to load annual report{error ? `: ${error.message}` : "."}
      </p>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <Card className="rounded-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <CardTitle>Annual Proposal Report</CardTitle>
            <CardValue>{data.budget.year}</CardValue>
            <p className="mt-1 text-xs text-zinc-500">
              Include/exclude proposal statuses below, then export using Print / PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
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
            <button
              type="button"
              onClick={exportToPdf}
              className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              Print / PDF
            </button>
          </div>
        </div>

        <div className="hidden print:block">
          <CardTitle>Annual Proposal Report</CardTitle>
          <CardValue>{data.budget.year}</CardValue>
          <p className="mt-1 text-xs text-zinc-500">
            Included statuses: {activeStatuses.map((status) => titleCase(status)).join(", ")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          {STATUS_OPTIONS.map((status) => (
            <label
              key={status}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                statusFilters[status]
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
              }`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={statusFilters[status]}
                onChange={() => toggleStatus(status)}
              />
              {titleCase(status)}
            </label>
          ))}
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Proposals</CardTitle>
          <CardValue>{filteredProposals.length}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total Amount</CardTitle>
          <CardValue>{currency(totalAmount)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Approved Amount</CardTitle>
          <CardValue>{currency(approvedAmount)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Sent Amount</CardTitle>
          <CardValue>{currency(sentAmount)}</CardValue>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Proposals by Status</CardTitle>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                <XAxis dataKey="label" tick={{ fill: chartText.axis, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: chartText.axis, fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusCounts.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                  <LabelList dataKey="count" position="top" fill={chartText.axis} fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Amount by Proposal Type</CardTitle>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeSplit}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${compactCurrency(Number(value))}`}
                >
                  {typeSplit.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                  <Label
                    value={`Total ${compactCurrency(totalAmount)}`}
                    position="center"
                    style={{ fill: chartText.axis, fontSize: 11, fontWeight: 600 }}
                  />
                </Pie>
                <Tooltip formatter={(value: number) => currency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <CardTitle>Year Proposals</CardTitle>
            <p className="text-xs text-zinc-500">Compact report table for the selected year and statuses.</p>
          </div>
          <p className="text-xs text-zinc-500">
            Showing {filteredProposals.length} of {data.proposals.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[860px] table-auto text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Proposal</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Sent Date</th>
                <th className="px-2 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-sm text-zinc-500">
                    No proposals match the selected status filters.
                  </td>
                </tr>
              ) : (
                filteredProposals.map((proposal) => (
                  <tr key={proposal.id} className="border-b align-top">
                    <td className="px-2 py-2">
                      <p className="font-medium">{proposal.title}</p>
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {titleCase(proposal.proposalType)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusPill status={proposal.status} />
                    </td>
                    <td className="px-2 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      {currency(proposal.progress.computedFinalAmount)}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {proposal.sentAt ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {proposal.createdAt.slice(0, 10)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
