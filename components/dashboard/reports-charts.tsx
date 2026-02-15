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
import { DirectionalCategory } from "@/lib/types";
import { compactCurrency, currency, formatNumber } from "@/lib/utils";
import { chartPalette, chartText } from "@/lib/chart-styles";

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
  categoryCounts,
  typeSplit,
  totalAmount
}: {
  categoryCounts: CategoryCountDatum[];
  typeSplit: TypeSplitDatum[];
  totalAmount: number;
}) {
  return (
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
  );
}
