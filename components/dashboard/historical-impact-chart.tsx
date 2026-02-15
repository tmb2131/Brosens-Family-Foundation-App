"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis
} from "recharts";
import { ChartLegend } from "@/components/ui/chart-legend";
import { chartPalette, chartText, chartTooltip } from "@/lib/chart-styles";
import type { HistoryByYearPoint } from "@/lib/types";
import { compactCurrency, currency } from "@/lib/utils";

export function HistoricalImpactChart({
  data
}: {
  data: HistoryByYearPoint[];
}) {
  const chartData = data.map((entry) => ({
    ...entry,
    totalSent: entry.jointSent + entry.discretionarySent
  }));

  const needsRotation = chartData.length > 4;

  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { label: "Joint sent", color: chartPalette.joint },
          { label: "Discretionary sent", color: chartPalette.discretionary }
        ]}
      />
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 22, right: 4, left: -10, bottom: needsRotation ? 16 : 0 }}
          >
            <XAxis
              dataKey="year"
              tick={{ fill: chartText.axis, fontSize: needsRotation ? 10 : 12 }}
              angle={needsRotation ? -45 : 0}
              textAnchor={needsRotation ? "end" : "middle"}
            />
            <Tooltip
              cursor={false}
              formatter={(value: number) => currency(value)}
              contentStyle={chartTooltip.contentStyle}
              labelStyle={chartTooltip.labelStyle}
              itemStyle={chartTooltip.itemStyle}
              wrapperStyle={chartTooltip.wrapperStyle}
              offset={chartTooltip.offset}
              allowEscapeViewBox={chartTooltip.allowEscapeViewBox}
            />
            <Bar stackId="sent" dataKey="jointSent" name="Joint sent" fill={chartPalette.joint} />
            <Bar
              stackId="sent"
              dataKey="discretionarySent"
              name="Discretionary sent"
              fill={chartPalette.discretionary}
              minPointSize={2}
              radius={[6, 6, 0, 0]}
            >
              <LabelList
                position="top"
                fill={chartText.axis}
                fontSize={11}
                fontWeight={600}
                dataKey="totalSent"
                formatter={(value: number) => compactCurrency(Number(value))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
