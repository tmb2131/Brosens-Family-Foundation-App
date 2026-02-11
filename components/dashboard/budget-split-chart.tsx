"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { currency } from "@/lib/utils";
import { chartPalette } from "@/lib/chart-styles";

export function BudgetSplitChart({
  joint,
  discretionary
}: {
  joint: number;
  discretionary: number;
}) {
  const data = [
    { name: "Joint (75%)", value: joint, color: chartPalette.joint },
    { name: "Discretionary (25%)", value: discretionary, color: chartPalette.discretionary }
  ];

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => currency(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
