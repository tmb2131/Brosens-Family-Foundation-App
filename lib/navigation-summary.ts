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

interface VoteRow {
  proposal_id: string;
  voter_id: string;
  choice: string;
}

interface VotingMemberRow {
  id: string;
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

async function getMeetingActionableCount(
  admin: AdminClient,
  budgetYear: number | null
) {
  if (budgetYear === null) return 0;

  const { data: proposals, error: proposalError } = await admin
    .from("grant_proposals")
    .select("id, proposal_type, proposer_id")
    .eq("status", "to_review")
    .eq("budget_year", budgetYear)
    .returns<ActionItemProposalRow[]>();

  if (proposalError) {
    throw new HttpError(500, `Could not load meeting proposals: ${proposalError.message}`);
  }

  if (!proposals?.length) return 0;

  const proposalIds = proposals.map((p) => p.id);

  const [votingMembersResult, votesResult] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id")
      .in("role", ["member", "oversight"])
      .returns<VotingMemberRow[]>(),
    admin
      .from("votes")
      .select("proposal_id, voter_id, choice")
      .in("proposal_id", proposalIds)
      .returns<VoteRow[]>()
  ]);

  if (votingMembersResult.error) {
    throw new HttpError(500, `Could not load voting members: ${votingMembersResult.error.message}`);
  }
  if (votesResult.error) {
    throw new HttpError(500, `Could not load meeting votes: ${votesResult.error.message}`);
  }

  const votingMemberIds = new Set((votingMembersResult.data ?? []).map((r) => r.id));

  const votesByProposal = new Map<string, VoteRow[]>();
  for (const vote of votesResult.data ?? []) {
    const existing = votesByProposal.get(vote.proposal_id);
    if (existing) {
      existing.push(vote);
    } else {
      votesByProposal.set(vote.proposal_id, [vote]);
    }
  }

  let count = 0;
  for (const proposal of proposals) {
    const allVotes = votesByProposal.get(proposal.id) ?? [];

    const eligibleVotes =
      proposal.proposal_type === "joint"
        ? allVotes.filter((v) => votingMemberIds.has(v.voter_id))
        : allVotes.filter((v) => votingMemberIds.has(v.voter_id) && v.voter_id !== proposal.proposer_id);

    const hasNoOrFlagged = eligibleVotes.some(
      (v) => v.choice === "no" || v.choice === "flagged"
    );
    if (hasNoOrFlagged) {
      count += 1;
      continue;
    }

    const requiredVotes =
      proposal.proposal_type === "joint"
        ? votingMemberIds.size
        : [...votingMemberIds].filter((id) => id !== proposal.proposer_id).length;

    if (eligibleVotes.length >= requiredVotes) {
      count += 1;
    }
  }

  return count;
}

export async function getNavigationSummary(
  admin: AdminClient,
  userId: string,
  role: AppRole
): Promise<NavigationSummarySnapshot> {
  const budgetYear = await getCurrentBudgetYearOrNull(admin);
  const toReviewCountPromise =
    budgetYear === null ? Promise.resolve(0) : countProposalsByStatus(admin, "to_review", budgetYear);

  const isMeetingRole = ["oversight", "manager"].includes(role);

  const [dashboardToReviewCount, workspaceActionItemsCount, adminApprovedCount, pendingPolicyNotificationsCount, meetingToReviewCount] =
    await Promise.all([
      toReviewCountPromise,
      getWorkspaceActionItemsCount(admin, userId, role, budgetYear),
      role === "admin" ? countProposalsByStatus(admin, "approved") : Promise.resolve(0),
      getPendingPolicyNotificationCount(admin, userId, role),
      isMeetingRole ? getMeetingActionableCount(admin, budgetYear) : Promise.resolve(0)
    ]);

  return {
    dashboardToReviewCount,
    workspaceActionItemsCount,
    meetingToReviewCount,
    adminApprovedCount,
    pendingPolicyNotificationsCount
  };
}
