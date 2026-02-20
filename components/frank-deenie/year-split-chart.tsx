"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, Cell } from "recharts";
import { ChartLegend } from "@/components/ui/chart-legend";
import { chartPalette, chartGradients, chartText, chartTooltip } from "@/lib/chart-styles";
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
            <defs>
              <linearGradient id="frankDeenieGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartGradients.sent.start} stopOpacity={1} />
                <stop offset="100%" stopColor={chartGradients.sent.end} stopOpacity={1} />
              </linearGradient>
              <linearGradient id="childrenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartGradients.children.start} stopOpacity={1} />
                <stop offset="100%" stopColor={chartGradients.children.end} stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="status" 
              tick={{ fill: chartText.axis, fontSize: 12 }}
              axisLine={{ stroke: chartText.axis, opacity: 0.3 }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 4 }}
              formatter={(value: number) => currency(value)}
              contentStyle={{
                ...chartTooltip.contentStyle,
                borderRadius: 8,
                border: 'none',
                boxShadow: '0 4px 12px hsl(222 47% 8% / 0.15)'
              }}
              labelStyle={chartTooltip.labelStyle}
              itemStyle={chartTooltip.itemStyle}
              wrapperStyle={chartTooltip.wrapperStyle}
              offset={chartTooltip.offset}
              allowEscapeViewBox={chartTooltip.allowEscapeViewBox}
            />
            <Bar 
              stackId="status" 
              dataKey="frankDeenie" 
              name="Frank & Deenie" 
              fill="url(#frankDeenieGradient)"
              radius={[6, 6, 0, 0]}
              animationDuration={800}
              animationBegin={0}
            />
            <Bar
              stackId="status"
              dataKey="children"
              name="Children"
              fill="url(#childrenGradient)"
              minPointSize={2}
              radius={[6, 6, 0, 0]}
              animationDuration={800}
              animationBegin={200}
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
