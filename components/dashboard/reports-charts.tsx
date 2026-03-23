"use client";

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
import { GlassCard, CardLabel } from "@/components/ui/card";
import { ChartLegend } from "@/components/ui/chart-legend";
import { DirectionalCategory, ProposalStatus } from "@/lib/types";
import { compactCurrency, currency, formatNumber } from "@/lib/utils";
import { chartPalette, chartText, chartTooltip } from "@/lib/chart-styles";

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

interface TypeSplitDatum {
  name: string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<ProposalStatus, string> = {
  to_review: chartPalette.review,
  approved: chartPalette.approved,
  sent: chartPalette.sent,
  declined: chartPalette.declined
};

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

export function ReportsCharts({
  statusCounts,
  categoryCounts,
  typeSplit,
  totalAmount
}: {
  statusCounts: StatusCountDatum[];
  categoryCounts: CategoryCountDatum[];
  typeSplit: TypeSplitDatum[];
  totalAmount: number;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-3 print:flex print:flex-col print:gap-4">
      <div className="contents print:hidden">
      <GlassCard>
        <CardLabel>Proposals by Status</CardLabel>
        <div className="h-[260px] w-full sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={statusCounts} margin={{ top: 4, right: 110, left: 8, bottom: 0 }}>
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
                width={100}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.55)" }}
                separator=""
                contentStyle={chartTooltip.contentStyle}
                labelStyle={chartTooltip.labelStyle}
                itemStyle={chartTooltip.itemStyle}
                wrapperStyle={chartTooltip.wrapperStyle}
                formatter={(value, _name, item) => {
                  const row = item.payload as StatusCountDatum | undefined;
                  if (!row) {
                    return [currency(Number(value)), ""];
                  }
                  return [`${formatNumber(row.count)} proposals | ${currency(row.amount)}`, ""];
                }}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as StatusCountDatum | undefined;
                  if (!row) {
                    return String(label);
                  }
                  return row.label;
                }}
              />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                {statusCounts.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
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
                contentStyle={chartTooltip.contentStyle}
                labelStyle={chartTooltip.labelStyle}
                itemStyle={chartTooltip.itemStyle}
                wrapperStyle={chartTooltip.wrapperStyle}
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
        <ChartLegend
          items={typeSplit.map(({ name, value, color }) => ({
            label: `${name}: ${compactCurrency(value)}`,
            color
          }))}
        />
        <div className="h-[200px] w-full sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Pie
                data={typeSplit}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={88}
                labelLine={false}
                label={false}
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
              <Tooltip
                contentStyle={chartTooltip.contentStyle}
                labelStyle={chartTooltip.labelStyle}
                itemStyle={chartTooltip.itemStyle}
                wrapperStyle={chartTooltip.wrapperStyle}
                formatter={(value: number) => currency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
      </div>

      <div className="hidden print:contents" data-report-print-summary-tables>
        <GlassCard className="report-print-summary-card">
          <CardLabel>Proposals by Status</CardLabel>
          <table className="report-print-summary-table mt-2 w-full">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col" className="report-print-summary-num text-right">
                  Count
                </th>
                <th scope="col" className="report-print-summary-num text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {statusCounts.map((row) => (
                <tr key={row.status}>
                  <td>{row.label}</td>
                  <td className="report-print-summary-num text-right tabular-nums">{formatNumber(row.count)}</td>
                  <td className="report-print-summary-num text-right tabular-nums">{currency(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>

        <GlassCard className="report-print-summary-card">
          <CardLabel>Proposals by Category</CardLabel>
          <table className="report-print-summary-table mt-2 w-full">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="report-print-summary-num text-right">
                  Count
                </th>
                <th scope="col" className="report-print-summary-num text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {categoryCounts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted-foreground">
                    No proposals in the selected filters.
                  </td>
                </tr>
              ) : (
                categoryCounts.map((row) => (
                  <tr key={row.category}>
                    <td>{row.label}</td>
                    <td className="report-print-summary-num text-right tabular-nums">{formatNumber(row.count)}</td>
                    <td className="report-print-summary-num text-right tabular-nums">{currency(row.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>

        <GlassCard className="report-print-summary-card">
          <CardLabel>Amount by Proposal Type</CardLabel>
          <table className="report-print-summary-table mt-2 w-full">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col" className="report-print-summary-num text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {typeSplit.map((row) => (
                <tr key={row.name}>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: row.color }}
                        aria-hidden
                      />
                      {row.name}
                    </span>
                  </td>
                  <td className="report-print-summary-num text-right tabular-nums">{currency(row.value)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row">Total</th>
                <td className="report-print-summary-num text-right tabular-nums">{currency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </GlassCard>
      </div>
    </section>
  );
}
