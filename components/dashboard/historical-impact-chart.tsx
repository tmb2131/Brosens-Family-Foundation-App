"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { chartPalette, chartText } from "@/lib/chart-styles";
import type { HistoryByYearPoint } from "@/lib/types";
import { currency } from "@/lib/utils";

export function HistoricalImpactChart({
  data
}: {
  data: HistoryByYearPoint[];
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
          <XAxis dataKey="year" tick={{ fill: chartText.axis, fontSize: 12 }} />
          <YAxis tickFormatter={(value) => `$${Math.round(value / 1000000)}M`} tick={{ fill: chartText.axis, fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) => currency(value)}
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
          />
          <Bar stackId="sent" dataKey="jointSent" name="Joint sent" fill={chartPalette.joint} />
          <Bar
            stackId="sent"
            dataKey="discretionarySent"
            name="Discretionary sent"
            fill={chartPalette.discretionary}
            minPointSize={2}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
