"use client";

import { CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn, currency } from "@/lib/utils";

interface PersonalBudgetBarsProps {
  title: string;
  allocated: number;
  total: number;
  /** Amount currently being input (e.g. in allocation field). Shown as a separate blue segment. */
  pendingAllocation?: number;
  /** Use smaller bar and tighter typography for compact layouts (e.g. mobile grid). */
  compact?: boolean;
  /** Stronger border for aggregate rows (e.g. total = joint + discretionary). */
  emphasizeBorder?: boolean;
}

const PENDING_BAR_STYLE = { backgroundColor: "rgb(var(--proposal-cta))" } as const;

export function PersonalBudgetBars({
  title,
  allocated,
  total,
  pendingAllocation = 0,
  compact = false,
  emphasizeBorder = false
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

  const barAriaLabel =
    total === 0
      ? `${title}. No budget.`
      : `${title}. ${currency(remaining)} left to allocate. Allocated ${currency(allocated)}${
          pendingAllocation > 0 ? `. Your input ${currency(pendingAllocation)}` : ""
        }. Budget cap ${currency(total)}.`;

  return (
    <div
      className={cn(
        "rounded-xl",
        compact ? "p-2" : "p-3",
        emphasizeBorder
          ? cn(
              "border-[3px] border-foreground/40 shadow-sm",
              compact ? "bg-muted/40" : "bg-muted/20"
            )
          : compact
            ? "border border-border/80 bg-muted/30"
            : "border"
      )}
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
      {compact ? (
        <div className="mt-1">
          <p className="text-sm font-semibold tabular-nums text-foreground">{currency(remaining)}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">left to allocate</p>
        </div>
      ) : (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-sm">
          <span className="font-semibold tabular-nums text-foreground">{currency(remaining)}</span>
          <span className="font-normal text-muted-foreground">left to allocate</span>
        </p>
      )}
      <div
        className={cn(
          "mt-2 w-full touch-manipulation rounded-full bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "h-1.5" : "h-2"
        )}
        tabIndex={0}
        aria-label={barAriaLabel}
      >
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
      {compact ? (
        <div className="mt-2 border-t border-border/60 pt-2">
          <p className="text-[10px] leading-snug text-muted-foreground">
            {isFullShare ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                {subtitle}
              </span>
            ) : (
              subtitle
            )}
          </p>
        </div>
      ) : (
        <>
          <Separator className="my-2" />
          <p className="text-[11px] leading-snug text-muted-foreground">
            {isFullShare ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {subtitle}
              </span>
            ) : (
              subtitle
            )}
          </p>
        </>
      )}
    </div>
  );
}
