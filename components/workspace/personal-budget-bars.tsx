"use client";

import { currency } from "@/lib/utils";

interface PersonalBudgetBarsProps {
  title: string;
  allocated: number;
  total: number;
}

export function PersonalBudgetBars({ title, allocated, total }: PersonalBudgetBarsProps) {
  const ratio = total === 0 ? 0 : Math.min(100, Math.round((allocated / total) * 100));

  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-semibold">
        {currency(allocated)} / {currency(total)}
      </p>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-accent" style={{ width: `${ratio}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{ratio}% allocated</p>
    </div>
  );
}
