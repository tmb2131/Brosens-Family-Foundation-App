"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, X } from "lucide-react";
import type { BudgetYearNotice } from "@/lib/types";
import { cn } from "@/lib/utils";

function dismissKey(notice: BudgetYearNotice) {
  return `budget-year-notice-dismissed:${notice.kind}:${notice.year}`;
}

function readDismissed(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function noticeCopy(notice: BudgetYearNotice): { message: string; action: string } {
  if (notice.kind === "upcoming") {
    return {
      message: `There's no ${notice.year} budget yet. Without one, proposals submitted from January 1 will count toward ${notice.year - 1}.`,
      action: `Set up ${notice.year} in Settings (enter ${notice.year} as the budget year)`
    };
  }

  if (notice.fallbackYear === null) {
    return {
      message: "No budget is set up yet, so proposals can't be submitted.",
      action: "Set up a budget in Settings"
    };
  }

  return {
    message: `There's no ${notice.year} budget yet, so new proposals are counting toward ${notice.fallbackYear}.`,
    action: `Set up ${notice.year} in Settings (enter ${notice.year} as the budget year)`
  };
}

/**
 * Reminds Oversight and the Manager to create the next budget year. The notice
 * comes from the navigation summary, which only sets it for those roles.
 * Dismissing hides it in this browser until the notice changes (December's
 * heads-up and January's warning are separate).
 */
export function BudgetYearBanner({ notice }: { notice: BudgetYearNotice | null }) {
  const key = notice ? dismissKey(notice) : null;
  // Start hidden so a dismissed banner never flashes before storage is read.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(key ? readDismissed(key) : true);
  }, [key]);

  if (!notice || !key || dismissed) {
    return null;
  }

  const { message, action } = noticeCopy(notice);

  const storageKey = key;
  function handleDismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage can be unavailable (private mode); hiding for this visit is enough.
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Budget year setup"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-3xl border p-4 print:hidden",
        notice.kind === "missing"
          ? "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-[hsl(var(--border)/0.5)] bg-card text-foreground"
      )}
    >
      <CalendarClock
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          notice.kind === "missing" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 text-sm">
        <p>{message}</p>
        <Link
          href="/settings#settings-budget"
          className="mt-1 inline-block font-semibold underline underline-offset-2 hover:no-underline"
        >
          {action}
        </Link>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-[hsl(var(--accent)/0.45)] focus-visible:outline-offset-2"
        aria-label="Dismiss budget year reminder"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
