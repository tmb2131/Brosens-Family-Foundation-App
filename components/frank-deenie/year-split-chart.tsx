"use client";

import { memo, useCallback, useMemo } from "react";
import type { SVGProps } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, Cell } from "recharts";
import { ChartLegend } from "@/components/ui/chart-legend";
import { chartPalette, chartGradients, chartText, chartTooltip } from "@/lib/chart-styles";
import { compactCurrency, currency } from "@/lib/utils";

type LabelRenderProps = Omit<SVGProps<SVGTextElement>, "viewBox"> & {
  value?: number | string;
  index?: number;
};

const SELECTIVE_LABEL_THRESHOLD = 5;
const LATEST_LABEL_NUDGE_PX = 8;
const LATEST_LABEL_RAISE_PX = 10;

export interface FrankDeenieYearSplitPoint {
  year: number;
  frankDeenie: number;
  children: number;
}

export const FrankDeenieYearSplitChart = memo(function FrankDeenieYearSplitChart({
  data,
  onYearClick,
  yearFormatter
}: {
  data: FrankDeenieYearSplitPoint[];
  onYearClick?: (year: number) => void;
  yearFormatter?: (year: number) => string;
}) {
  const chartData = useMemo(
    () => data.map((entry) => ({ ...entry, total: entry.frankDeenie + entry.children })),
    [data]
  );

  const labelIndices = useMemo(() => {
    if (chartData.length <= SELECTIVE_LABEL_THRESHOLD) return null;

    let minIdx = 0;
    let maxIdx = 0;
    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i].total < chartData[minIdx].total) minIdx = i;
      if (chartData[i].total > chartData[maxIdx].total) maxIdx = i;
    }
    const lastIdx = chartData.length - 1;
    return new Set([minIdx, maxIdx, lastIdx]);
  }, [chartData]);

  const renderLabel = useCallback(
    ({ x: rawX, y: rawY, width: rawW, value, index }: LabelRenderProps) => {
      if (value == null || index == null) return null;
      if (labelIndices && !labelIndices.has(index)) return null;

      const cx = Number(rawX ?? 0) + Number(rawW ?? 0) / 2;
      const baseY = Number(rawY ?? 0);
      const cy = baseY - 6;
      const isLatest = index === chartData.length - 1;
      const label = compactCurrency(Number(value));
      const x = isLatest ? cx - LATEST_LABEL_NUDGE_PX : cx;
      const y = isLatest ? baseY - LATEST_LABEL_RAISE_PX : cy;
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          fill={isLatest && labelIndices ? chartText.label : chartText.axis}
          fontSize={11}
          fontWeight={isLatest && labelIndices ? 700 : 600}
        >
          {label}
        </text>
      );
    },
    [labelIndices, chartData.length]
  );

  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { label: "Frank & Deenie", color: chartPalette.sent },
          { label: "Children", color: chartPalette.children }
        ]}
      />
      {onYearClick && (
        <p className="mb-1 text-center text-[10px] text-muted-foreground">Tap a bar to see donations</p>
      )}
      <div className="h-[176px] w-full sm:h-[188px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 22, right: 16, left: 0, bottom: 0 }}
            onClick={onYearClick ? (state) => {
              if (state?.activePayload?.[0]?.payload?.year) {
                onYearClick(state.activePayload[0].payload.year);
              }
            } : undefined}
            style={onYearClick ? { cursor: "pointer" } : undefined}
          >
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
              dataKey="year" 
              tick={{ fill: chartText.axis, fontSize: 12 }}
              axisLine={{ stroke: chartText.axis, opacity: 0.3 }}
              tickFormatter={yearFormatter}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 4 }}
              formatter={(value: number) => currency(value)}
              labelFormatter={yearFormatter ? (label: number) => yearFormatter(label) : undefined}
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
              stackId="year" 
              dataKey="frankDeenie" 
              name="Frank & Deenie" 
              fill="url(#frankDeenieGradient)"
              animationDuration={800}
              animationBegin={0}
            />
            <Bar
              stackId="year"
              dataKey="children"
              name="Children"
              fill="url(#childrenGradient)"
              radius={[6, 6, 0, 0]}
              animationDuration={800}
              animationBegin={200}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.year}
                  fill={entry.children > 0 ? "url(#childrenGradient)" : "transparent"}
                />
              ))}
              <LabelList
                position="top"
                dataKey="total"
                content={renderLabel}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
