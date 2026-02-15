import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import { getPendingPolicyNotificationCount } from "@/lib/policy-data";
import { AppRole, NavigationSummarySnapshot, ProposalType } from "@/lib/types";

type AdminClient = SupabaseClient;

interface BudgetYearRow {
  budget_year: number;
}

interface ActionItemProposalRow {
  id: string;
  proposal_type: ProposalType;
  proposer_id: string;
}

interface VoteProposalIdRow {
  proposal_id: string;
}

async function getCurrentBudgetYearOrNull(admin: AdminClient) {
  const thisYear = new Date().getFullYear();

  const { data: currentBudget, error: currentBudgetError } = await admin
    .from("budgets")
    .select("budget_year")
    .eq("budget_year", thisYear)
    .maybeSingle<BudgetYearRow>();

  if (currentBudgetError) {
    throw new HttpError(500, `Could not load current budget year: ${currentBudgetError.message}`);
  }

  if (currentBudget) {
    return currentBudget.budget_year;
  }

  const { data: fallbackBudget, error: fallbackBudgetError } = await admin
    .from("budgets")
    .select("budget_year")
    .order("budget_year", { ascending: false })
    .limit(1)
    .maybeSingle<BudgetYearRow>();

  if (fallbackBudgetError) {
    throw new HttpError(500, `Could not load fallback budget year: ${fallbackBudgetError.message}`);
  }

  return fallbackBudget?.budget_year ?? null;
}

async function countProposalsByStatus(
  admin: AdminClient,
  status: "to_review" | "approved",
  budgetYear?: number
) {
  if (budgetYear === undefined) {
    const { count, error } = await admin
      .from("grant_proposals")
      .select("id", { count: "exact", head: true })
      .eq("status", status);

    if (error) {
      throw new HttpError(500, `Could not count ${status} proposals: ${error.message}`);
    }

    return count ?? 0;
  }

  const { count, error } = await admin
    .from("grant_proposals")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .eq("budget_year", budgetYear);

  if (error) {
    throw new HttpError(500, `Could not count ${status} proposals: ${error.message}`);
  }

  return count ?? 0;
}

async function getWorkspaceActionItemsCount(
  admin: AdminClient,
  userId: string,
  role: AppRole,
  budgetYear: number | null
) {
  if (!["member", "oversight"].includes(role)) {
    return 0;
  }

  if (budgetYear === null) {
    return 0;
  }

  const { data: proposalRows, error: proposalError } = await admin
    .from("grant_proposals")
    .select("id, proposal_type, proposer_id")
    .eq("status", "to_review")
    .eq("budget_year", budgetYear)
    .returns<ActionItemProposalRow[]>();

  if (proposalError) {
    throw new HttpError(500, `Could not load workspace action item proposals: ${proposalError.message}`);
  }

  const proposals = proposalRows ?? [];
  if (!proposals.length) {
    return 0;
  }

  const proposalIds = proposals.map((proposal) => proposal.id);
  const { data: voteRows, error: voteError } = await admin
    .from("votes")
    .select("proposal_id")
    .eq("voter_id", userId)
    .in("proposal_id", proposalIds)
    .returns<VoteProposalIdRow[]>();

  if (voteError) {
    throw new HttpError(500, `Could not load workspace action item votes: ${voteError.message}`);
  }

  const votedProposalIds = new Set((voteRows ?? []).map((vote) => vote.proposal_id));
  let actionItemCount = 0;

  for (const proposal of proposals) {
    const proposerAutoCompletesDiscretionary =
      proposal.proposal_type === "discretionary" && proposal.proposer_id === userId;
    if (proposerAutoCompletesDiscretionary) {
      continue;
    }

    if (votedProposalIds.has(proposal.id)) {
      continue;
    }

    actionItemCount += 1;
  }

  return actionItemCount;
}

export async function getNavigationSummary(
  admin: AdminClient,
  userId: string,
  role: AppRole
): Promise<NavigationSummarySnapshot> {
  const budgetYear = await getCurrentBudgetYearOrNull(admin);
  const toReviewCountPromise =
    budgetYear === null ? Promise.resolve(0) : countProposalsByStatus(admin, "to_review", budgetYear);

  const [dashboardToReviewCount, workspaceActionItemsCount, adminApprovedCount, pendingPolicyNotificationsCount] =
    await Promise.all([
      toReviewCountPromise,
      getWorkspaceActionItemsCount(admin, userId, role, budgetYear),
      role === "admin" ? countProposalsByStatus(admin, "approved") : Promise.resolve(0),
      getPendingPolicyNotificationCount(admin, userId, role)
    ]);

  return {
    dashboardToReviewCount,
    workspaceActionItemsCount,
    meetingToReviewCount: ["oversight", "manager"].includes(role) ? dashboardToReviewCount : 0,
    adminApprovedCount,
    pendingPolicyNotificationsCount
  };
}
