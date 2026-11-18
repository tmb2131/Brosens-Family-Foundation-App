"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RefreshErrorNoticeProps {
  /** The SWR error, if any. Nothing renders without one. */
  error: unknown;
  onRetry: () => void;
  className?: string;
}

/**
 * Shown when a background refresh fails but the page still has data from an
 * earlier load. Keeps that data on screen (a dropped poll during a meeting
 * should not blank the page) while saying it may be out of date.
 */
export function RefreshErrorNotice({ error, onRetry, className }: RefreshErrorNoticeProps) {
  if (!error) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Couldn&apos;t refresh. Showing the last data loaded.</span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40"
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        Retry
      </button>
    </div>
  );
}
