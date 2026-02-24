"use client";

import { CheckCircle2 } from "lucide-react";
import { currency } from "@/lib/utils";

interface PersonalBudgetBarsProps {
  title: string;
  allocated: number;
  total: number;
  /** Amount currently being input (e.g. in allocation field). Shown as a separate blue segment. */
  pendingAllocation?: number;
  /** Use smaller bar and tighter typography for compact layouts (e.g. mobile grid). */
  compact?: boolean;
}

const PENDING_BAR_STYLE = { backgroundColor: "rgb(var(--proposal-cta))" } as const;

export function PersonalBudgetBars({
  title,
  allocated,
  total,
  pendingAllocation = 0,
  compact = false
}: PersonalBudgetBarsProps) {
  const allocatedRatio =
    total === 0 ? 0 : Math.min(100, Math.round((allocated / total) * 100));
  const pendingRatio =
    total === 0 ? 0 : Math.min(100 - allocatedRatio, Math.round((pendingAllocation / total) * 100));
  const remaining = Math.max(0, total - allocated - pendingAllocation);
  const committedTotal = allocated + pendingAllocation;
  const isFullShare = total > 0 && committedTotal >= total;
  const committedPct =
    total === 0 ? 0 : Math.min(100, Math.round((committedTotal / total) * 100));

  const subtitle =
    total === 0
      ? "No budget"
      : isFullShare
        ? "You've committed your full share"
        : `${committedPct}% committed of your share (${currency(total)})`;

  return (
    <div
      className={compact ? "rounded-xl border border-border/80 bg-muted/30 p-2" : "rounded-xl border p-3"}
    >
      <p
        className={
          compact
            ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            : "text-xs uppercase tracking-wide text-muted-foreground"
        }
      >
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {currency(remaining)}
      </p>
      <p className={compact ? "text-[10px] text-muted-foreground" : "text-xs text-muted-foreground"}>
        {isFullShare ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {subtitle}
          </span>
        ) : (
          <>{subtitle}</>
        )}
      </p>
      <div className={compact ? "mt-2 h-1.5 rounded-full bg-muted" : "mt-2 h-2 rounded-full bg-muted"}>
        <div className="flex h-full overflow-hidden rounded-full">
          {allocatedRatio > 0 ? (
            <div
              className={`h-full shrink-0 bg-accent ${pendingRatio > 0 ? "rounded-l-full" : "rounded-full"}`}
              style={{ width: `${allocatedRatio}%` }}
              aria-hidden
            />
          ) : null}
          {pendingRatio > 0 ? (
            <div
              className={`h-full shrink-0 ${allocatedRatio > 0 ? "rounded-r-full" : "rounded-full"}`}
              style={{ width: `${pendingRatio}%`, ...PENDING_BAR_STYLE }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
