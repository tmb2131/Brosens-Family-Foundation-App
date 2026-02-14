"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ChartLegend } from "@/components/ui/chart-legend";
import { chartPalette, chartText, chartTooltip } from "@/lib/chart-styles";
import { compactCurrency, currency } from "@/lib/utils";

export interface FrankDeenieYearSplitPoint {
  status: "Gave" | "Planned";
  frankDeenie: number;
  children: number;
}

export function FrankDeenieYearSplitChart({
  data
}: {
  data: FrankDeenieYearSplitPoint[];
}) {
  const chartData = data.map((entry) => ({
    ...entry,
    total: entry.frankDeenie + entry.children
  }));

  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { label: "Frank & Deenie", color: chartPalette.sent },
          { label: "Children", color: chartPalette.children }
        ]}
      />
      <div className="h-[176px] w-full sm:h-[188px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="status" tick={{ fill: chartText.axis, fontSize: 12 }} />
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
            <Bar stackId="status" dataKey="frankDeenie" name="Frank & Deenie" fill={chartPalette.sent} />
            <Bar
              stackId="status"
              dataKey="children"
              name="Children"
              fill={chartPalette.children}
              minPointSize={2}
              radius={[6, 6, 0, 0]}
            >
              <LabelList
                position="top"
                fill={chartText.axis}
                fontSize={11}
                fontWeight={600}
                dataKey="total"
                formatter={(value: number) => compactCurrency(Number(value))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
