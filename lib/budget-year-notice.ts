import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import type { AppRole, BudgetYearNotice } from "@/lib/types";

/** The roles that can create budgets (POST /api/budgets, Settings → Budget Management). */
export const BUDGET_MANAGER_ROLES: AppRole[] = ["oversight", "manager"];

/** Every year that has a budget record. The table holds one row per year. */
export async function loadBudgetYears(admin: SupabaseClient): Promise<number[]> {
  const { data, error } = await admin
    .from("budgets")
    .select("budget_year")
    .returns<Array<{ budget_year: number }>>();

  if (error) {
    throw new HttpError(500, `Could not load budget years: ${error.message}`);
  }

  return (data ?? []).map((row) => row.budget_year);
}

/**
 * The budget year the app works in: this calendar year when it has a budget,
 * otherwise the latest one. Mirrors getCurrentBudget and get_foundation_page_data.
 */
export function resolveActiveBudgetYear(budgetYears: number[], now: Date = new Date()): number | null {
  const thisYear = now.getFullYear();
  if (budgetYears.includes(thisYear)) {
    return thisYear;
  }
  return budgetYears.length ? Math.max(...budgetYears) : null;
}

/**
 * Whether a budget year needs setting up.
 *
 * When this calendar year has no budget, the app quietly falls back to the
 * latest one, so from January 1 new proposals are filed under last year's
 * budget and spend what is left of it. This flags that while there is still
 * time (all of December, if next year has no budget) and for as long as it
 * stays true (from January 1, if this year has none).
 */
export function getBudgetYearNotice(
  budgetYears: number[],
  now: Date = new Date()
): BudgetYearNotice | null {
  const thisYear = now.getFullYear();

  if (!budgetYears.includes(thisYear)) {
    return { kind: "missing", year: thisYear, fallbackYear: resolveActiveBudgetYear(budgetYears, now) };
  }

  if (now.getMonth() === 11 && !budgetYears.includes(thisYear + 1)) {
    return { kind: "upcoming", year: thisYear + 1 };
  }

  return null;
}

export async function loadBudgetYearNotice(admin: SupabaseClient): Promise<BudgetYearNotice | null> {
  return getBudgetYearNotice(await loadBudgetYears(admin));
}
