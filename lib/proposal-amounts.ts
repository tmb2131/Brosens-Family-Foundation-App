import type { ProposalType } from "@/lib/types";

/** The columns needed to read a settled proposal's amount from its row alone. */
export interface SettledAmountRow {
  proposal_type: ProposalType;
  final_amount: number | string | null;
  /** Absent on rows read before the column existed; treated as not saved. */
  approved_amount?: number | string | null;
}

/**
 * What an approved or sent proposal was awarded, for readers that only have the
 * row (emails, the Frank & Deenie ledger, giving history) and no votes.
 *
 * `final_amount` is the amount that was requested. A discretionary grant is
 * awarded exactly that. A joint grant is awarded the sum of the members'
 * allocations, which is saved to `approved_amount` when it is approved; joint
 * grants without one (imported history, and checks returned before the column
 * existed) keep using `final_amount`, as every reader did before.
 *
 * `buildProposalViews` reaches the same number by a longer route, because it
 * also handles open proposals from their votes.
 */
export function settledProposalAmount(row: SettledAmountRow): number {
  const raw =
    row.proposal_type === "joint" && row.approved_amount != null
      ? row.approved_amount
      : row.final_amount;
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
