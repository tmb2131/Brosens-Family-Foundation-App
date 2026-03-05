"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList
} from "recharts";
import { Building2, ChevronLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartLegend } from "@/components/ui/chart-legend";
import { chartPalette, chartGradients, chartText, chartTooltip } from "@/lib/chart-styles";
import { currency, compactCurrency } from "@/lib/utils";
import type { OrganizationGivingHistory } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CharityGivingHistoryProps {
  charityName: string;
  organizationId?: string | null;
  onBack?: () => void;
}

export function CharityGivingHistory({
  charityName,
  organizationId,
  onBack
}: CharityGivingHistoryProps) {
  const params = new URLSearchParams({ name: charityName });
  if (organizationId) params.set("organizationId", organizationId);

  const { data, isLoading, error } = useSWR<OrganizationGivingHistory>(
    `/api/organizations/giving-history?${params.toString()}`,
    fetcher
  );

  const [showChart, setShowChart] = useState(true);
  const [includeChildren, setIncludeChildren] = useState(false);

  if (isLoading) {
    return <GivingHistorySkeleton name={charityName} onBack={onBack} />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Header name={charityName} onBack={onBack} includeChildren={includeChildren} onToggleChildren={setIncludeChildren} />
        <p className="text-sm text-muted-foreground">
          Could not load giving history. Please try again.
        </p>
      </div>
    );
  }

  const visibleEntries = includeChildren
    ? data.entries
    : data.entries
        .map((e) => ({
          ...e,
          childrenAmount: 0,
          totalAmount: e.frankDeenieAmount,
          percentOfYear: e.yearFrankDeenieTotal > 0
            ? Math.round((e.frankDeenieAmount / e.yearFrankDeenieTotal) * 10000) / 100
            : 0
        }))
        .filter((e) => e.totalAmount > 0);

  const visibleGrandTotal = includeChildren ? data.grandTotal : data.frankDeenieGrandTotal;
  const visibleChildrenGrandTotal = includeChildren ? data.childrenGrandTotal : 0;

  if (visibleEntries.length === 0) {
    return (
      <div className="space-y-4">
        <Header name={charityName} onBack={onBack} includeChildren={includeChildren} onToggleChildren={setIncludeChildren} />
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-muted/20 p-8 text-center">
          <div className="mb-3 rounded-full border border-border bg-muted p-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No giving history found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No sent proposals or Frank &amp; Deenie donations were found for this organization.
          </p>
        </div>
      </div>
    );
  }

  const hasBothSources = includeChildren && data.childrenGrandTotal > 0 && data.frankDeenieGrandTotal > 0;
  const chartEntries = [...visibleEntries].reverse();

  return (
    <div className="space-y-4">
      <Header name={data.charityName} onBack={onBack} includeChildren={includeChildren} onToggleChildren={setIncludeChildren} />

      {/* Grand total */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Lifetime giving
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
          {currency(visibleGrandTotal)}
        </p>
        {hasBothSources ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Children: {currency(visibleChildrenGrandTotal)}</span>
            <span>Frank &amp; Deenie: {currency(data.frankDeenieGrandTotal)}</span>
          </div>
        ) : null}
      </div>

      {/* Chart toggle */}
      {visibleEntries.length > 1 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowChart((prev) => !prev)}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {showChart ? "Hide chart" : "Show chart"}
          </button>
          {showChart ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <ChartLegend
                items={[
                  { label: "Frank & Deenie", color: chartPalette.sent },
                  { label: "Children", color: chartPalette.children }
                ]}
              />
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartEntries}
                    margin={{ top: 20, right: 4, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="ghFrankDeenieGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartGradients.sent.start} stopOpacity={1} />
                        <stop offset="100%" stopColor={chartGradients.sent.end} stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="ghChildrenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartGradients.children.start} stopOpacity={1} />
                        <stop offset="100%" stopColor={chartGradients.children.end} stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="year"
                      tick={{ fill: chartText.axis, fontSize: 11 }}
                      axisLine={{ stroke: chartText.axis, opacity: 0.3 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: chartText.axis, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => compactCurrency(v)}
                      width={52}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 4 }}
                      formatter={(value: number) => currency(value)}
                      contentStyle={{
                        ...chartTooltip.contentStyle,
                        borderRadius: 8,
                        border: "none",
                        boxShadow: "0 4px 12px hsl(222 47% 8% / 0.15)"
                      }}
                      labelStyle={chartTooltip.labelStyle}
                      itemStyle={chartTooltip.itemStyle}
                      wrapperStyle={chartTooltip.wrapperStyle}
                      offset={chartTooltip.offset}
                      allowEscapeViewBox={chartTooltip.allowEscapeViewBox}
                    />
                    <Bar
                      stackId="amount"
                      dataKey="frankDeenieAmount"
                      name="Frank & Deenie"
                      fill="url(#ghFrankDeenieGradient)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={600}
                    />
                    <Bar
                      stackId="amount"
                      dataKey="childrenAmount"
                      name="Children"
                      fill="url(#ghChildrenGradient)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={600}
                      animationBegin={150}
                    >
                      <LabelList
                        position="top"
                        fill={chartText.axis}
                        fontSize={10}
                        fontWeight={600}
                        dataKey="totalAmount"
                        formatter={(v: number) => compactCurrency(Number(v))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Year-by-year table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5">Year</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="px-3 py-2.5 text-right">
                % of {includeChildren ? "All" : "F&D"} Giving
              </th>
              {hasBothSources ? (
                <th className="hidden px-3 py-2.5 text-right sm:table-cell">Source</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleEntries.map((entry) => (
              <tr key={entry.year} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-semibold tabular-nums">{entry.year}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {currency(entry.totalAmount)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {entry.percentOfYear.toFixed(1)}%
                </td>
                {hasBothSources ? (
                  <td className="hidden px-3 py-2.5 text-right text-xs text-muted-foreground sm:table-cell">
                    <div className="flex flex-col gap-0.5">
                      {entry.childrenAmount > 0 ? (
                        <span>Children: {currency(entry.childrenAmount)}</span>
                      ) : null}
                      {entry.frankDeenieAmount > 0 ? (
                        <span>F&amp;D: {currency(entry.frankDeenieAmount)}</span>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40">
            <tr className="font-bold">
              <td className="px-3 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{currency(visibleGrandTotal)}</td>
              <td className="px-3 py-2.5" />
              {hasBothSources ? <td className="hidden sm:table-cell" /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Header({
  name,
  onBack,
  includeChildren,
  onToggleChildren
}: {
  name: string;
  onBack?: () => void;
  includeChildren?: boolean;
  onToggleChildren?: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {onBack ? (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Giving History
        </p>
        <h3 className="truncate text-base font-bold text-foreground">{name}</h3>
      </div>
      {onToggleChildren ? (
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/50">
          <input
            type="checkbox"
            checked={includeChildren ?? false}
            onChange={(event) => onToggleChildren(event.target.checked)}
            className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
          />
          Include Children
        </label>
      ) : null}
    </div>
  );
}

function GivingHistorySkeleton({
  name,
  onBack
}: {
  name: string;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      <Header name={name} onBack={onBack} />
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-32" />
      </div>
      <div className="rounded-xl border border-border p-3">
        <Skeleton className="h-[160px] w-full rounded-lg" />
      </div>
      <div className="rounded-xl border border-border">
        <div className="space-y-3 p-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
