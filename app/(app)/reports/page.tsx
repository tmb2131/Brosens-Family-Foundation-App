"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Bar,
  BarChart,
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
import { ClipboardList, Download, DollarSign, PieChart as PieChartIcon, Send } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { DataTableHeadRow, DataTableRow, DataTableSortButton } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DirectionalCategory,
  DIRECTIONAL_CATEGORIES,
  DIRECTIONAL_CATEGORY_LABELS,
  FoundationSnapshot,
  ProposalStatus
} from "@/lib/types";
import { compactCurrency, currency, formatNumber, titleCase } from "@/lib/utils";
import { chartPalette, chartText } from "@/lib/chart-styles";

const STATUS_OPTIONS: ProposalStatus[] = ["to_review", "approved", "sent", "declined"];
const STATUS_COLORS: Record<ProposalStatus, string> = {
  to_review: "#0EA5E9",
  approved: "#10B981",
  sent: "#6366F1",
  declined: "#F43F5E"
};

type StatusFilterState = Record<ProposalStatus, boolean>;
type SelectedYear = number | "all" | null;
type CategoryFilter = "all" | DirectionalCategory;
type ReportSortKey = "proposal" | "type" | "status" | "amount" | "sentAt" | "category";
type SortDirection = "asc" | "desc";

const STATUS_RANK: Record<ProposalStatus, number> = {
  to_review: 0,
  approved: 1,
  sent: 2,
  declined: 3
};

const DEFAULT_STATUS_FILTERS: StatusFilterState = {
  to_review: true,
  approved: true,
  sent: true,
  declined: true
};

interface StatusCountDatum {
  status: ProposalStatus;
  label: string;
  count: number;
  amount: number;
  countAndAmountLabel: string;
}

interface CategoryCountDatum {
  category: DirectionalCategory;
  label: string;
  count: number;
  amount: number;
  countAndAmountLabel: string;
}

const CATEGORY_COLORS: Record<DirectionalCategory, string> = {
  arts_culture: "#8B5CF6",
  education: "#0EA5E9",
  environment: "#10B981",
  health: "#F43F5E",
  housing: "#F59E0B",
  international_aid: "#6366F1",
  food_security: "#14B8A6",
  other: "#94A3B8"
};

function sumAmount(rows: FoundationSnapshot["proposals"]) {
  return rows.reduce((sum, row) => sum + row.progress.computedFinalAmount, 0);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<SelectedYear>(null);
  const [statusFilters, setStatusFilters] = useState<StatusFilterState>(DEFAULT_STATUS_FILTERS);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortKey, setSortKey] = useState<ReportSortKey>("proposal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const canAccess = user ? user.role === "oversight" || user.role === "manager" : false;

  const foundationKey = useMemo(() => {
    if (!canAccess) {
      return null;
    }

    if (selectedYear === null) {
      return "/api/foundation";
    }

    if (selectedYear === "all") {
      return "/api/foundation?allYears=1";
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

    if (selectedYear === null || selectedYear === "all") {
      return;
    }

    if (!availableYears.includes(selectedYear)) {
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

    const filtered = data.proposals
      .filter((proposal) => statusFilters[proposal.status])
      .filter((proposal) =>
        categoryFilter === "all"
          ? true
          : proposal.organizationDirectionalCategory === categoryFilter
      );

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "proposal") {
        comparison = a.title.localeCompare(b.title);
      } else if (sortKey === "type") {
        comparison = a.proposalType.localeCompare(b.proposalType);
      } else if (sortKey === "status") {
        comparison = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      } else if (sortKey === "amount") {
        comparison = a.progress.computedFinalAmount - b.progress.computedFinalAmount;
      } else if (sortKey === "sentAt") {
        comparison = (a.sentAt ?? "").localeCompare(b.sentAt ?? "");
      } else if (sortKey === "category") {
        comparison = DIRECTIONAL_CATEGORY_LABELS[a.organizationDirectionalCategory].localeCompare(
          DIRECTIONAL_CATEGORY_LABELS[b.organizationDirectionalCategory]
        );
      }

      if (comparison === 0) {
        comparison = a.title.localeCompare(b.title);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [categoryFilter, data, sortDirection, sortKey, statusFilters]);

  const toggleSort = (nextKey: ReportSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  };

  const sortMarker = (key: ReportSortKey) => {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ^" : " v";
  };

  const statusCounts = useMemo<StatusCountDatum[]>(
    () =>
      STATUS_OPTIONS.map((status) => {
        const proposalsForStatus = filteredProposals.filter((proposal) => proposal.status === status);
        const count = proposalsForStatus.length;
        const amount = sumAmount(proposalsForStatus);
        return {
          status,
          label: titleCase(status),
          count,
          amount,
          countAndAmountLabel: `${formatNumber(count)} | ${compactCurrency(amount)}`
        };
      }),
    [filteredProposals]
  );

  const categoryCounts = useMemo<CategoryCountDatum[]>(
    () =>
      DIRECTIONAL_CATEGORIES.map((category) => {
        const proposalsForCategory = filteredProposals.filter(
          (proposal) => proposal.organizationDirectionalCategory === category
        );
        const count = proposalsForCategory.length;
        const amount = sumAmount(proposalsForCategory);
        return {
          category,
          label: DIRECTIONAL_CATEGORY_LABELS[category],
          count,
          amount,
          countAndAmountLabel: count > 0 ? `${formatNumber(count)} | ${compactCurrency(amount)}` : ""
        };
      }).filter((entry) => entry.count > 0).sort((a, b) => b.amount - a.amount),
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
  const currentReportYear =
    typeof selectedYear === "number" ? selectedYear : data?.budget.year ?? new Date().getFullYear();
  const isAllYearsView = selectedYear === "all";
  const selectedYearLabel = isAllYearsView ? "All years" : String(currentReportYear);
  const selectedYearFilterValue =
    selectedYear === "all" ? "all" : String(selectedYear ?? currentReportYear);

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
    document.title = `Foundation Report ${selectedYearLabel} - ${statusLabel || "No Statuses"}`;
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
      <GlassCard>
        <CardLabel>Reports</CardLabel>
        <p className="mt-2 text-sm text-rose-600">
          This page is available only to Oversight and Manager users.
        </p>
      </GlassCard>
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
    <div className="page-stack pb-6">
      <GlassCard className="rounded-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <CardLabel>Annual Proposal Report</CardLabel>
            <CardValue>{selectedYearLabel}</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <span className="status-dot bg-emerald-500" />
              Include/exclude proposal statuses below, then export using Print / PDF.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <label className="text-xs font-semibold text-zinc-500">
              Budget year
              <select
                className="field-control field-control--compact mt-1 block"
                value={selectedYearFilterValue}
                onChange={(event) =>
                  setSelectedYear(event.target.value === "all" ? "all" : Number(event.target.value))
                }
              >
                <option value="all">All years</option>
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
              className="prominent-accent-cta"
            >
              <Download className="h-4 w-4" />
              Print / PDF
            </button>
          </div>
        </div>

        <div className="hidden print:block">
          <CardLabel>Annual Proposal Report</CardLabel>
          <CardValue>{selectedYearLabel}</CardValue>
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
                className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                checked={statusFilters[status]}
                onChange={() => toggleStatus(status)}
              />
              {titleCase(status)}
            </label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 print:hidden">
          <label
            className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold ${
              categoryFilter === "all"
                ? "border-accent bg-accent/10 text-accent"
                : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={categoryFilter === "all"}
              onChange={() => setCategoryFilter("all")}
            />
            All categories
          </label>
          {DIRECTIONAL_CATEGORIES.map((category) => (
            <label
              key={category}
              className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                categoryFilter === category
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={categoryFilter === category}
                onChange={() => setCategoryFilter(category)}
              />
              {DIRECTIONAL_CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </GlassCard>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="PROPOSALS"
          value={formatNumber(filteredProposals.length)}
          icon={ClipboardList}
          tone="emerald"
        />
        <MetricCard title="TOTAL AMOUNT" value={currency(totalAmount)} icon={DollarSign} tone="sky" />
        <MetricCard
          title="APPROVED AMOUNT"
          value={currency(approvedAmount)}
          icon={PieChartIcon}
          tone="indigo"
        />
        <MetricCard title="SENT AMOUNT" value={currency(sentAmount)} icon={Send} tone="amber" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <GlassCard>
          <CardLabel>Proposals by Category</CardLabel>
          <div className="h-[260px] w-full sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={categoryCounts} margin={{ top: 4, right: 110, left: 8, bottom: 0 }}>
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    compactCurrency(Number(value), {
                      maximumFractionDigits: 0
                    })
                  }
                  tick={{ fill: chartText.axis, fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: chartText.axis, fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  width={155}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.55)" }}
                  separator=""
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))"
                  }}
                  labelStyle={{ color: "hsl(var(--foreground) / 0.92)", fontWeight: 600 }}
                  itemStyle={{ color: "hsl(var(--foreground) / 0.84)" }}
                  formatter={(value, _name, item) => {
                    const row = item.payload as CategoryCountDatum | undefined;
                    if (!row) {
                      return [currency(Number(value)), ""];
                    }
                    return [`${formatNumber(row.count)} proposals | ${currency(row.amount)}`, ""];
                  }}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as CategoryCountDatum | undefined;
                    if (!row) {
                      return String(label);
                    }
                    return row.label;
                  }}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {categoryCounts.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
                  ))}
                  <LabelList
                    dataKey="countAndAmountLabel"
                    position="right"
                    content={({ x, y, width, height, value }) => (
                      <text
                        x={Number(x) + Number(width) + 6}
                        y={Number(y) + Number(height) / 2}
                        dominantBaseline="central"
                        fill={chartText.axis}
                        fontSize={11}
                        fontWeight={600}
                      >
                        {String(value)}
                      </text>
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <CardLabel>Amount by Proposal Type</CardLabel>
          <div className="h-[190px] w-full sm:h-[210px]">
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
        </GlassCard>
      </section>

      <GlassCard>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <CardLabel>Year Proposals</CardLabel>
            <p className="text-xs text-zinc-500">
              Compact report table for {isAllYearsView ? "all years" : `budget year ${selectedYearLabel}`} and statuses.
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            Showing {formatNumber(filteredProposals.length)} of {formatNumber(data.proposals.length)}
          </p>
        </div>

        <div className="space-y-2 md:hidden">
          {filteredProposals.length === 0 ? (
            <p className="rounded-xl border p-4 text-sm text-zinc-500">
              No proposals match the selected status filters.
            </p>
          ) : (
            filteredProposals.map((proposal) => (
              <article
                key={proposal.id}
                className={`rounded-xl border border-t-2 p-4 ${
                  proposal.proposalType === "joint"
                    ? "border-t-indigo-400 dark:border-t-indigo-500"
                    : "border-t-amber-400 dark:border-t-amber-500"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{proposal.title}</p>
                  <StatusPill status={proposal.status} />
                </div>
                <p className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {currency(proposal.progress.computedFinalAmount)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <p>Type: {titleCase(proposal.proposalType)}</p>
                  <p>Sent: {proposal.sentAt ?? "—"}</p>
                  <p className="col-span-2">Category: {DIRECTIONAL_CATEGORY_LABELS[proposal.organizationDirectionalCategory]}</p>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[860px] table-auto text-left text-sm">
            <thead>
              <DataTableHeadRow>
                <th className="px-2 py-2">
                  <DataTableSortButton onClick={() => toggleSort("proposal")}>Proposal{sortMarker("proposal")}</DataTableSortButton>
                </th>
                <th className="px-2 py-2">
                  <DataTableSortButton onClick={() => toggleSort("type")}>Type{sortMarker("type")}</DataTableSortButton>
                </th>
                <th className="px-2 py-2">
                  <DataTableSortButton onClick={() => toggleSort("status")}>Status{sortMarker("status")}</DataTableSortButton>
                </th>
                <th className="px-2 py-2">
                  <DataTableSortButton onClick={() => toggleSort("amount")}>Amount{sortMarker("amount")}</DataTableSortButton>
                </th>
                <th className="px-2 py-2">
                  <DataTableSortButton onClick={() => toggleSort("sentAt")}>Sent Date{sortMarker("sentAt")}</DataTableSortButton>
                </th>
                <th className="px-2 py-2">
                  <DataTableSortButton onClick={() => toggleSort("category")}>Category{sortMarker("category")}</DataTableSortButton>
                </th>
              </DataTableHeadRow>
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
                  <DataTableRow key={proposal.id}>
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
                      {DIRECTIONAL_CATEGORY_LABELS[proposal.organizationDirectionalCategory]}
                    </td>
                  </DataTableRow>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
