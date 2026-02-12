import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import {
  AppRole,
  AllocationMode,
  FoundationSnapshot,
  GrantProposal,
  HistoryByYearPoint,
  Organization,
  ProposalStatus,
  ProposalType,
  UserProfile,
  Vote,
  VoteChoice,
  WorkspaceSnapshot
} from "@/lib/types";
import { isVotingRole } from "@/lib/auth-server";

type AdminClient = SupabaseClient;

interface BudgetRow {
  id: string;
  budget_year: number;
  annual_fund_size: number | string;
  rollover_from_previous_year: number | string;
  joint_ratio: number | string;
  discretionary_ratio: number | string;
  meeting_reveal_enabled: boolean;
}

interface ProposalRow {
  id: string;
  grant_master_id: string;
  organization_id: string | null;
  proposer_id: string;
  budget_year: number;
  proposal_type: ProposalType;
  allocation_mode: AllocationMode;
  status: ProposalStatus;
  reveal_votes: boolean;
  final_amount: number | string;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
}

interface GrantMasterRow {
  id: string;
  title: string;
  description: string | null;
}

interface VoteRow {
  id: string;
  proposal_id: string;
  voter_id: string;
  choice: VoteChoice;
  allocation_amount: number | string;
  created_at: string;
}

interface OrganizationRow {
  id: string;
  name: string;
  website: string | null;
  charity_navigator_score: number | string | null;
  cause_area: string | null;
}

const PROPOSAL_SELECT =
  "id, grant_master_id, organization_id, proposer_id, budget_year, proposal_type, allocation_mode, status, reveal_votes, final_amount, notes, sent_at, created_at";

const EDITABLE_PROPOSAL_STATUSES: ProposalStatus[] = ["to_review", "approved", "sent", "declined"];

export interface HistoricalProposalImportRow {
  title: string;
  description: string;
  organizationName: string;
  budgetYear: number;
  finalAmount: number;
  status: ProposalStatus;
  proposalType: ProposalType;
  allocationMode: AllocationMode;
  notes: string;
  createdAt?: string;
  sentAt?: string;
  website?: string;
  causeArea?: string;
  charityNavigatorScore?: number;
}

function currentYear() {
  return new Date().getFullYear();
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase();
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeDateString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw new HttpError(400, "Invalid date. Use YYYY-MM-DD or a valid ISO timestamp.");
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new HttpError(500, message);
  }
  return value;
}

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    website: row.website ?? "",
    charityNavigatorScore: toNumber(row.charity_navigator_score),
    causeArea: row.cause_area ?? "General"
  };
}

function mapVote(row: VoteRow): Vote {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    userId: row.voter_id,
    choice: row.choice,
    allocationAmount: toNumber(row.allocation_amount),
    createdAt: row.created_at
  };
}

function mapProposal(row: ProposalRow, grant: GrantMasterRow | undefined): GrantProposal {
  return {
    id: row.id,
    grantMasterId: row.grant_master_id,
    organizationId: row.organization_id ?? "",
    title: grant?.title ?? "Untitled Proposal",
    description: grant?.description ?? "",
    proposerId: row.proposer_id,
    budgetYear: row.budget_year,
    proposalType: row.proposal_type,
    allocationMode: row.proposal_type === "joint" ? "sum" : row.allocation_mode,
    proposedAmount: toNumber(row.final_amount),
    status: row.status,
    revealVotes: row.reveal_votes,
    notes: row.notes,
    sentAt: row.sent_at,
    createdAt: row.created_at
  };
}

function computeFinalAmount(proposal: GrantProposal, votes: Vote[]) {
  if (proposal.proposalType === "joint") {
    return votes.reduce((sum, vote) => sum + vote.allocationAmount, 0);
  }

  return roundCurrency(proposal.proposedAmount);
}

function getEligibleVotesForProposal(proposal: GrantProposal, votes: Vote[], votingMemberIds: string[]) {
  if (proposal.proposalType === "joint") {
    return votes.filter((vote) => votingMemberIds.includes(vote.userId));
  }

  return votes.filter(
    (vote) => votingMemberIds.includes(vote.userId) && vote.userId !== proposal.proposerId
  );
}

async function getVotingMemberIds(admin: AdminClient) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, role")
    .in("role", ["member", "oversight"]);

  if (error) {
    throw new HttpError(500, `Could not load voting member profiles: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id as string);
}

async function getCurrentBudget(admin: AdminClient): Promise<BudgetRow> {
  const year = currentYear();

  const { data: current, error: currentError } = await admin
    .from("budgets")
    .select(
      "id, budget_year, annual_fund_size, rollover_from_previous_year, joint_ratio, discretionary_ratio, meeting_reveal_enabled"
    )
    .eq("budget_year", year)
    .maybeSingle<BudgetRow>();

  if (currentError) {
    throw new HttpError(500, `Could not load current budget: ${currentError.message}`);
  }

  if (current) {
    return current;
  }

  const { data: latest, error: latestError } = await admin
    .from("budgets")
    .select(
      "id, budget_year, annual_fund_size, rollover_from_previous_year, joint_ratio, discretionary_ratio, meeting_reveal_enabled"
    )
    .order("budget_year", { ascending: false })
    .limit(1)
    .maybeSingle<BudgetRow>();

  if (latestError) {
    throw new HttpError(500, `Could not load fallback budget: ${latestError.message}`);
  }

  if (!latest) {
    throw new HttpError(400, "No budget configured yet. Create one in Settings first.");
  }

  return latest;
}

async function getBudgetByYearOrNull(admin: AdminClient, budgetYear: number) {
  const { data, error } = await admin
    .from("budgets")
    .select(
      "id, budget_year, annual_fund_size, rollover_from_previous_year, joint_ratio, discretionary_ratio, meeting_reveal_enabled"
    )
    .eq("budget_year", budgetYear)
    .maybeSingle<BudgetRow>();

  if (error) {
    throw new HttpError(500, `Could not load budget for year ${budgetYear}: ${error.message}`);
  }

  return data ?? null;
}

async function getCurrentBudgetOrNull(admin: AdminClient) {
  try {
    return await getCurrentBudget(admin);
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) {
      return null;
    }
    throw error;
  }
}

async function getBudgetForYearOrDefault(admin: AdminClient, budgetYear?: number) {
  if (budgetYear === undefined) {
    return getCurrentBudgetOrNull(admin);
  }

  if (!Number.isInteger(budgetYear) || budgetYear < 1900 || budgetYear > 3000) {
    throw new HttpError(400, "budgetYear must be a valid year.");
  }

  return getBudgetByYearOrNull(admin, budgetYear);
}

async function loadAvailableBudgetYears(admin: AdminClient, includedYear?: number) {
  const [budgetYearsResult, proposalYearsResult] = await Promise.all([
    admin.from("budgets").select("budget_year").returns<Array<{ budget_year: number }>>(),
    admin.from("grant_proposals").select("budget_year").returns<Array<{ budget_year: number }>>()
  ]);

  if (budgetYearsResult.error) {
    throw new HttpError(500, `Could not load budget years: ${budgetYearsResult.error.message}`);
  }

  if (proposalYearsResult.error) {
    throw new HttpError(
      500,
      `Could not load proposal budget years: ${proposalYearsResult.error.message}`
    );
  }

  const yearSet = new Set<number>();
  for (const row of budgetYearsResult.data ?? []) {
    yearSet.add(row.budget_year);
  }
  for (const row of proposalYearsResult.data ?? []) {
    yearSet.add(row.budget_year);
  }
  if (includedYear !== undefined) {
    yearSet.add(includedYear);
  }

  if (!yearSet.size) {
    yearSet.add(currentYear());
  }

  return [...yearSet].sort((a, b) => b - a);
}

function buildAnnualCycle() {
  const now = new Date();
  const resetDate = new Date(Date.UTC(now.getUTCFullYear(), 1, 1));
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));

  return {
    resetDate: resetDate.toISOString().slice(0, 10),
    yearEndDeadline: yearEnd.toISOString().slice(0, 10),
    monthHint:
      now.getUTCMonth() === 0
        ? "January review period: define areas of improvement before Feb 1 reset."
        : now.getUTCMonth() === 1
        ? "February active cycle: budget reset is in effect."
        : "In-cycle mode: allocations continue until Dec 31 year-end close."
  };
}

function emptyFoundationSnapshot(
  year = currentYear(),
  availableBudgetYears: number[] = [year]
): FoundationSnapshot {
  return {
    budget: {
      year,
      total: 0,
      jointPool: 0,
      discretionaryPool: 0,
      jointAllocated: 0,
      discretionaryAllocated: 0,
      jointRemaining: 0,
      discretionaryRemaining: 0,
      rolloverFromPreviousYear: 0
    },
    proposals: [],
    historyByYear: [],
    availableBudgetYears,
    annualCycle: buildAnnualCycle()
  };
}

async function loadProposalRowsByYear(admin: AdminClient, budgetYear: number) {
  const { data, error } = await admin
    .from("grant_proposals")
    .select(PROPOSAL_SELECT)
    .eq("budget_year", budgetYear)
    .order("created_at", { ascending: false })
    .returns<ProposalRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load proposals: ${error.message}`);
  }

  return data ?? [];
}

async function loadProposalRowsByIds(admin: AdminClient, proposalIds: string[]) {
  if (!proposalIds.length) {
    return [];
  }

  const { data, error } = await admin
    .from("grant_proposals")
    .select(PROPOSAL_SELECT)
    .in("id", proposalIds)
    .returns<ProposalRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load proposals by id: ${error.message}`);
  }

  return data ?? [];
}

async function loadGrantMasterRows(admin: AdminClient, grantIds: string[]) {
  if (!grantIds.length) {
    return [];
  }

  const { data, error } = await admin
    .from("grants_master")
    .select("id, title, description")
    .in("id", grantIds)
    .returns<GrantMasterRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load grants master: ${error.message}`);
  }

  return data ?? [];
}

async function loadOrganizationRows(admin: AdminClient, organizationIds: string[]) {
  if (!organizationIds.length) {
    return [];
  }

  const { data, error } = await admin
    .from("organizations")
    .select("id, name, website, charity_navigator_score, cause_area")
    .in("id", organizationIds)
    .returns<OrganizationRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load organizations: ${error.message}`);
  }

  return data ?? [];
}

async function loadVotesByProposalIds(admin: AdminClient, proposalIds: string[]) {
  if (!proposalIds.length) {
    return [];
  }

  const { data, error } = await admin
    .from("votes")
    .select("id, proposal_id, voter_id, choice, allocation_amount, created_at")
    .in("proposal_id", proposalIds)
    .returns<VoteRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load votes: ${error.message}`);
  }

  return (data ?? []).map(mapVote);
}

function groupVotes(votes: Vote[]) {
  const grouped = new Map<string, Vote[]>();
  for (const vote of votes) {
    const existing = grouped.get(vote.proposalId) ?? [];
    existing.push(vote);
    grouped.set(vote.proposalId, existing);
  }
  return grouped;
}

function buildProposalViews(input: {
  proposals: ProposalRow[];
  grantById: Map<string, GrantMasterRow>;
  organizationById: Map<string, OrganizationRow>;
  votesByProposalId: Map<string, Vote[]>;
  currentUserId?: string;
  votingMemberIds: string[];
}) {
  return input.proposals.map((row) => {
    const grant = input.grantById.get(row.grant_master_id);
    const organization = row.organization_id
      ? input.organizationById.get(row.organization_id)
      : undefined;

    const proposal = mapProposal(row, grant);
    const rawVotes = input.votesByProposalId.get(proposal.id) ?? [];
    const votes = getEligibleVotesForProposal(proposal, rawVotes, input.votingMemberIds);

    const requiredVotes =
      proposal.proposalType === "joint"
        ? input.votingMemberIds.length
        : input.votingMemberIds.filter((id) => id !== proposal.proposerId).length;

    const votesSubmitted = votes.length;

    const hasCurrentUserVoted = input.currentUserId
      ? proposal.proposalType === "discretionary" && input.currentUserId === proposal.proposerId
        ? true
        : votes.some((vote) => vote.userId === input.currentUserId)
      : false;

    const masked = !(proposal.revealVotes || hasCurrentUserVoted);
    const hasRawVotes = votes.length > 0;
    const computedFromVotes = computeFinalAmount(proposal, votes);
    const shouldUseStoredJointAmount =
      proposal.proposalType === "joint" &&
      proposal.budgetYear < currentYear() &&
      !hasRawVotes &&
      ["approved", "sent"].includes(row.status);
    const computedFinalAmount = shouldUseStoredJointAmount
      ? toNumber(row.final_amount)
      : computedFromVotes;

    return {
      ...proposal,
      organizationName: organization?.name ?? "Unknown Organization",
      voteBreakdown: votes.map((vote) => ({
        userId: vote.userId,
        choice: vote.choice,
        allocationAmount: vote.allocationAmount,
        createdAt: vote.createdAt
      })),
      progress: {
        totalRequiredVotes: requiredVotes,
        votesSubmitted,
        hasCurrentUserVoted,
        masked,
        computedFinalAmount,
        isReadyForMeeting: votesSubmitted >= requiredVotes
      }
    };
  });
}

async function loadProposalsWithDependencies(admin: AdminClient, proposalRows: ProposalRow[]) {
  const proposalIds = proposalRows.map((row) => row.id);
  const grantIds = unique(proposalRows.map((row) => row.grant_master_id));
  const organizationIds = unique(
    proposalRows.map((row) => row.organization_id).filter((value): value is string => Boolean(value))
  );

  const [grantRows, organizationRows, votes] = await Promise.all([
    loadGrantMasterRows(admin, grantIds),
    loadOrganizationRows(admin, organizationIds),
    loadVotesByProposalIds(admin, proposalIds)
  ]);

  return {
    grantById: new Map(grantRows.map((row) => [row.id, row])),
    organizationById: new Map(organizationRows.map((row) => [row.id, row])),
    votesByProposalId: groupVotes(votes)
  };
}

async function computeHistoryByYear(admin: AdminClient, votingMemberIds: string[]) {
  const { data: approvedRows, error } = await admin
    .from("grant_proposals")
    .select(PROPOSAL_SELECT)
    .in("status", ["approved", "sent"])
    .returns<ProposalRow[]>();

  if (error) {
    throw new HttpError(500, `Could not compute history: ${error.message}`);
  }

  const proposals = approvedRows ?? [];
  if (!proposals.length) {
    return [];
  }

  const proposalIds = proposals.map((row) => row.id);
  const votes = await loadVotesByProposalIds(admin, proposalIds);
  const votesByProposalId = groupVotes(votes);

  const totalsByYear = new Map<number, { jointSent: number; discretionarySent: number }>();

  for (const row of proposals) {
    const proposal = mapProposal(row, undefined);
    const rawProposalVotes = votesByProposalId.get(proposal.id) ?? [];
    const relevantVotes = getEligibleVotesForProposal(proposal, rawProposalVotes, votingMemberIds);
    const hasRecordedRelevantVotes = relevantVotes.length > 0;

    const shouldUseStoredJointAmount =
      proposal.proposalType === "joint" &&
      proposal.budgetYear < currentYear() &&
      !hasRecordedRelevantVotes;
    const total = shouldUseStoredJointAmount
      ? toNumber(row.final_amount)
      : computeFinalAmount(proposal, relevantVotes);
    const existingYearTotals = totalsByYear.get(proposal.budgetYear) ?? {
      jointSent: 0,
      discretionarySent: 0
    };

    if (proposal.proposalType === "joint") {
      existingYearTotals.jointSent += total;
    } else {
      existingYearTotals.discretionarySent += total;
    }

    totalsByYear.set(proposal.budgetYear, existingYearTotals);
  }

  return [...totalsByYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, yearTotals]): HistoryByYearPoint => {
      const jointSent = Math.round(yearTotals.jointSent);
      const discretionarySent = Math.round(yearTotals.discretionarySent);
      return {
        year,
        jointSent,
        discretionarySent,
        totalDonated: jointSent + discretionarySent
      };
    });
}

export async function getFoundationSnapshot(
  admin: AdminClient,
  currentUserId?: string,
  budgetYear?: number
): Promise<FoundationSnapshot> {
  const budget = await getBudgetForYearOrDefault(admin, budgetYear);
  const availableBudgetYears = await loadAvailableBudgetYears(admin, budget?.budget_year ?? budgetYear);

  if (!budget) {
    return emptyFoundationSnapshot(
      budgetYear !== undefined ? budgetYear : currentYear(),
      availableBudgetYears
    );
  }

  const votingMemberIds = await getVotingMemberIds(admin);

  const proposalRows = await loadProposalRowsByYear(admin, budget.budget_year);
  const deps = await loadProposalsWithDependencies(admin, proposalRows);

  const proposals = buildProposalViews({
    proposals: proposalRows,
    grantById: deps.grantById,
    organizationById: deps.organizationById,
    votesByProposalId: deps.votesByProposalId,
    currentUserId,
    votingMemberIds
  });

  let jointAllocated = 0;
  let discretionaryAllocated = 0;

  for (const proposal of proposals) {
    if (proposal.status !== "approved" && proposal.status !== "sent") {
      continue;
    }

    if (proposal.proposalType === "joint") {
      jointAllocated += proposal.progress.computedFinalAmount;
    } else {
      discretionaryAllocated += proposal.progress.computedFinalAmount;
    }
  }

  const total = toNumber(budget.annual_fund_size) + toNumber(budget.rollover_from_previous_year);
  const jointPool = Math.round(total * toNumber(budget.joint_ratio));
  const discretionaryPool = Math.round(total * toNumber(budget.discretionary_ratio));

  return {
    budget: {
      year: budget.budget_year,
      total,
      jointPool,
      discretionaryPool,
      jointAllocated,
      discretionaryAllocated,
      jointRemaining: Math.max(0, jointPool - jointAllocated),
      discretionaryRemaining: Math.max(0, discretionaryPool - discretionaryAllocated),
      rolloverFromPreviousYear: toNumber(budget.rollover_from_previous_year)
    },
    proposals,
    historyByYear: await computeHistoryByYear(admin, votingMemberIds),
    availableBudgetYears,
    annualCycle: buildAnnualCycle()
  };
}

export async function getWorkspaceSnapshot(
  admin: AdminClient,
  user: UserProfile
): Promise<WorkspaceSnapshot> {
  const foundation = await getFoundationSnapshot(admin, user.id);
  const votingMemberIds = await getVotingMemberIds(admin);

  const { data: userVoteRows, error: userVoteError } = await admin
    .from("votes")
    .select("id, proposal_id, voter_id, choice, allocation_amount, created_at")
    .eq("voter_id", user.id)
    .order("created_at", { ascending: false })
    .returns<VoteRow[]>();

  if (userVoteError) {
    throw new HttpError(500, `Could not load user votes: ${userVoteError.message}`);
  }

  const userVotes = (userVoteRows ?? []).map(mapVote);
  const votedProposalIds = unique(userVotes.map((vote) => vote.proposalId));
  const votedProposalRows = await loadProposalRowsByIds(admin, votedProposalIds);
  const votedProposalById = new Map(votedProposalRows.map((row) => [row.id, row]));

  const votedGrantRows = await loadGrantMasterRows(
    admin,
    unique(votedProposalRows.map((row) => row.grant_master_id))
  );
  const votedGrantById = new Map(votedGrantRows.map((row) => [row.id, row]));

  const jointTarget = Math.round(foundation.budget.jointPool / Math.max(votingMemberIds.length, 1));
  const discretionaryCap = Math.min(
    5_000_000,
    Math.round(foundation.budget.discretionaryPool / Math.max(votingMemberIds.length, 1))
  );

  const jointAllocated = userVotes
    .filter((vote) => {
      const proposal = votedProposalById.get(vote.proposalId);
      return proposal?.budget_year === foundation.budget.year && proposal.proposal_type === "joint";
    })
    .reduce((sum, vote) => sum + vote.allocationAmount, 0);

  const discretionaryProposed = foundation.proposals
    .filter(
      (proposal) =>
        proposal.budgetYear === foundation.budget.year &&
        proposal.proposalType === "discretionary" &&
        proposal.proposerId === user.id &&
        proposal.status !== "declined"
    )
    .reduce((sum, proposal) => sum + proposal.progress.computedFinalAmount, 0);

  const actionItems = isVotingRole(user.role)
    ? foundation.proposals
        .filter((proposal) => proposal.status === "to_review")
        .filter((proposal) => !proposal.progress.hasCurrentUserVoted)
        .map((proposal) => ({
          proposalId: proposal.id,
          title: proposal.title,
          proposalType: proposal.proposalType,
          voteProgressLabel: `${proposal.progress.votesSubmitted} of ${proposal.progress.totalRequiredVotes} votes in`
        }))
    : [];

  const voteHistory = userVotes.map((vote) => {
    const proposal = votedProposalById.get(vote.proposalId);
    const grant = proposal ? votedGrantById.get(proposal.grant_master_id) : undefined;

    return {
      proposalId: vote.proposalId,
      proposalTitle: grant?.title ?? "Unknown Proposal",
      choice: vote.choice,
      amount: vote.allocationAmount,
      at: vote.createdAt
    };
  });

  const { data: submittedProposalRows, error: submittedError } = await admin
    .from("grant_proposals")
    .select(PROPOSAL_SELECT)
    .eq("proposer_id", user.id)
    .order("created_at", { ascending: false })
    .returns<ProposalRow[]>();

  if (submittedError) {
    throw new HttpError(500, `Could not load submitted proposals: ${submittedError.message}`);
  }

  const submittedRows = submittedProposalRows ?? [];
  const submittedGrantRows = await loadGrantMasterRows(
    admin,
    unique(submittedRows.map((row) => row.grant_master_id))
  );
  const submittedGrantById = new Map(submittedGrantRows.map((row) => [row.id, row]));

  const submittedGifts = submittedRows.map((row) =>
    mapProposal(row, submittedGrantById.get(row.grant_master_id))
  );

  return {
    user,
    personalBudget: {
      jointTarget,
      jointAllocated,
      jointRemaining: Math.max(0, jointTarget - jointAllocated),
      discretionaryCap,
      discretionaryAllocated: discretionaryProposed,
      discretionaryRemaining: Math.max(0, discretionaryCap - discretionaryProposed)
    },
    actionItems,
    voteHistory,
    submittedGifts
  };
}

export async function listOrganizations(admin: AdminClient) {
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, website, charity_navigator_score, cause_area")
    .order("name", { ascending: true })
    .returns<OrganizationRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load organizations: ${error.message}`);
  }

  return (data ?? []).map(mapOrganization);
}

export async function listProposalTitleSuggestions(admin: AdminClient, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const queryLimit = Math.max(25, Math.min(500, safeLimit * 5));

  const { data, error } = await admin
    .from("grants_master")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(queryLimit)
    .returns<Array<Pick<GrantMasterRow, "title">>>();

  if (error) {
    throw new HttpError(500, `Could not load proposal title suggestions: ${error.message}`);
  }

  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const row of data ?? []) {
    const title = String(row.title ?? "").trim();
    if (!title) {
      continue;
    }

    const normalizedTitle = normalizeLookupValue(title);
    if (seen.has(normalizedTitle)) {
      continue;
    }

    seen.add(normalizedTitle);
    suggestions.push(title);

    if (suggestions.length >= safeLimit) {
      break;
    }
  }

  return suggestions;
}

export async function submitProposal(
  admin: AdminClient,
  input: {
    title: string;
    description: string;
    proposalType: ProposalType;
    allocationMode: AllocationMode;
    proposedAmount: number;
    proposer: UserProfile;
  }
) {
  const normalizedProposedAmount = roundCurrency(input.proposedAmount);

  if (input.proposalType === "discretionary") {
    const workspace = await getWorkspaceSnapshot(admin, input.proposer);
    const discretionaryRemaining = roundCurrency(workspace.personalBudget.discretionaryRemaining);

    if (normalizedProposedAmount > discretionaryRemaining) {
      throw new HttpError(
        400,
        `Discretionary proposal amount cannot exceed your remaining discretionary budget of ${discretionaryRemaining.toLocaleString(
          "en-US",
          {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
          }
        )}.`
      );
    }
  }

  const budget = await getCurrentBudget(admin);
  const allocationMode: AllocationMode = input.proposalType === "joint" ? "sum" : input.allocationMode;

  const { data: existingGrant, error: existingGrantError } = await admin
    .from("grants_master")
    .select("id")
    .eq("title", input.title)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingGrantError) {
    throw new HttpError(500, `Could not check existing grant: ${existingGrantError.message}`);
  }

  let grantMasterId = existingGrant?.id;

  if (!grantMasterId) {
    const { data: insertedGrant, error: insertGrantError } = await admin
      .from("grants_master")
      .insert({
        title: input.title,
        description: input.description,
        cause_area: "General",
        organization_id: null,
        created_by: input.proposer.id
      })
      .select("id")
      .single<{ id: string }>();

    if (insertGrantError || !insertedGrant) {
      throw new HttpError(
        500,
        `Could not create grant master entry: ${insertGrantError?.message ?? "missing row"}`
      );
    }

    grantMasterId = insertedGrant.id;
  }

  const { data: insertedProposal, error: insertProposalError } = await admin
    .from("grant_proposals")
    .insert({
      grant_master_id: grantMasterId,
      organization_id: null,
      proposer_id: input.proposer.id,
      budget_year: budget.budget_year,
      proposal_type: input.proposalType,
      allocation_mode: allocationMode,
      final_amount: normalizedProposedAmount,
      status: "to_review",
      reveal_votes: false
    })
    .select(PROPOSAL_SELECT)
    .single<ProposalRow>();

  if (insertProposalError || !insertedProposal) {
    throw new HttpError(
      500,
      `Could not create proposal: ${insertProposalError?.message ?? "missing row"}`
    );
  }

  return insertedProposal;
}

export async function submitVote(
  admin: AdminClient,
  input: {
    proposalId: string;
    voterId: string;
    choice: VoteChoice;
    allocationAmount: number;
  }
) {
  const { data: proposal, error: proposalError } = await admin
    .from("grant_proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", input.proposalId)
    .maybeSingle<ProposalRow>();

  if (proposalError) {
    throw new HttpError(500, `Could not load proposal for vote: ${proposalError.message}`);
  }

  if (!proposal) {
    throw new HttpError(404, "Proposal not found.");
  }

  if (proposal.status !== "to_review") {
    throw new HttpError(400, "Votes can only be submitted while the proposal is To Review.");
  }

  const votingMemberIds = await getVotingMemberIds(admin);
  if (!votingMemberIds.includes(input.voterId)) {
    throw new HttpError(403, "Only voting family members can cast votes.");
  }

  if (proposal.proposal_type === "discretionary" && input.voterId === proposal.proposer_id) {
    throw new HttpError(403, "Discretionary proposer cannot vote on their own proposal.");
  }

  const allowedChoices: VoteChoice[] =
    proposal.proposal_type === "joint" ? ["yes", "no"] : ["acknowledged", "flagged"];
  if (!allowedChoices.includes(input.choice)) {
    throw new HttpError(
      400,
      proposal.proposal_type === "joint"
        ? 'Joint proposals accept only "yes" or "no" votes.'
        : 'Discretionary proposals accept only "acknowledged" or "flagged" votes.'
    );
  }

  const normalizedAmount =
    proposal.proposal_type === "joint" && input.choice === "yes"
      ? Math.max(0, Math.round(input.allocationAmount))
      : 0;

  const { error: voteError } = await admin.from("votes").upsert(
    {
      proposal_id: input.proposalId,
      voter_id: input.voterId,
      choice: input.choice,
      allocation_amount: normalizedAmount
    },
    { onConflict: "proposal_id,voter_id" }
  );

  if (voteError) {
    throw new HttpError(500, `Could not save vote: ${voteError.message}`);
  }

  return { ok: true };
}

export async function getMeetingProposals(admin: AdminClient, currentUserId: string) {
  const budget = await getCurrentBudgetOrNull(admin);
  if (!budget) {
    return [];
  }
  const votingMemberIds = await getVotingMemberIds(admin);

  const proposalRows = (await loadProposalRowsByYear(admin, budget.budget_year)).filter(
    (row) => row.status === "to_review"
  );

  const deps = await loadProposalsWithDependencies(admin, proposalRows);

  return buildProposalViews({
    proposals: proposalRows,
    grantById: deps.grantById,
    organizationById: deps.organizationById,
    votesByProposalId: deps.votesByProposalId,
    currentUserId,
    votingMemberIds
  });
}

async function getProposalViewById(admin: AdminClient, proposalId: string, currentUserId?: string) {
  const proposalRows = await loadProposalRowsByIds(admin, [proposalId]);
  const proposal = must(proposalRows[0], "Updated proposal not found after write.");
  const deps = await loadProposalsWithDependencies(admin, [proposal]);
  const votingMemberIds = await getVotingMemberIds(admin);

  return buildProposalViews({
    proposals: [proposal],
    grantById: deps.grantById,
    organizationById: deps.organizationById,
    votesByProposalId: deps.votesByProposalId,
    currentUserId,
    votingMemberIds
  })[0];
}

export async function setMeetingReveal(
  admin: AdminClient,
  proposalId: string,
  reveal: boolean,
  currentUserId?: string
) {
  const { error } = await admin
    .from("grant_proposals")
    .update({ reveal_votes: reveal })
    .eq("id", proposalId);

  if (error) {
    throw new HttpError(500, `Could not update reveal state: ${error.message}`);
  }

  return getProposalViewById(admin, proposalId, currentUserId);
}

export async function setMeetingDecision(
  admin: AdminClient,
  proposalId: string,
  status: "approved" | "declined" | "sent",
  currentUserId?: string
) {
  const sentAt = status === "sent" ? new Date().toISOString().slice(0, 10) : null;
  const { error } = await admin
    .from("grant_proposals")
    .update({ status, reveal_votes: true, sent_at: sentAt })
    .eq("id", proposalId);

  if (error) {
    throw new HttpError(500, `Could not update proposal decision: ${error.message}`);
  }

  return getProposalViewById(admin, proposalId, currentUserId);
}

export async function updateProposalRecord(
  admin: AdminClient,
  input: {
    proposalId: string;
    requesterId: string;
    requesterRole: AppRole;
    status?: ProposalStatus;
    finalAmount?: number;
    notes?: string | null;
    sentAt?: string | null;
    currentUserId?: string;
  }
) {
  const proposalRows = await loadProposalRowsByIds(admin, [input.proposalId]);
  const proposal = proposalRows[0];

  if (!proposal) {
    throw new HttpError(404, "Proposal not found.");
  }

  const isHistorical = proposal.budget_year < currentYear();
  const canEditHistorical = input.requesterRole === "oversight" && isHistorical;
  const isProposer = proposal.proposer_id === input.requesterId;
  const touchesHistoricalFields =
    input.status !== undefined || input.finalAmount !== undefined || input.notes !== undefined;

  if (!canEditHistorical) {
    if (!isProposer || touchesHistoricalFields || input.sentAt === undefined) {
      throw new HttpError(
        403,
        "Only oversight can edit historical proposals. Other users may only update sent date on their own proposal."
      );
    }

    if (proposal.status !== "sent") {
      throw new HttpError(400, "Sent date can only be recorded when the proposal status is Sent.");
    }
  }

  const updates: Record<string, unknown> = {};
  let nextStatus: ProposalStatus = proposal.status;

  if (canEditHistorical && input.status !== undefined) {
    if (!EDITABLE_PROPOSAL_STATUSES.includes(input.status)) {
      throw new HttpError(
        400,
        `Invalid status. Must be one of ${EDITABLE_PROPOSAL_STATUSES.join(", ")}.`
      );
    }

    nextStatus = input.status;
    updates.status = input.status;
  }

  if (canEditHistorical && input.finalAmount !== undefined) {
    if (!Number.isFinite(input.finalAmount) || input.finalAmount < 0) {
      throw new HttpError(400, "finalAmount must be a non-negative number.");
    }
    updates.final_amount = roundCurrency(input.finalAmount);
  }

  if (canEditHistorical && input.notes !== undefined) {
    const notes = input.notes === null ? "" : String(input.notes);
    updates.notes = notes.trim() ? notes.trim() : null;
  }

  if (input.sentAt !== undefined) {
    const sentAt =
      input.sentAt === null ? null : normalizeDateString(typeof input.sentAt === "string" ? input.sentAt : "");

    if (sentAt && nextStatus !== "sent") {
      throw new HttpError(400, "Sent date requires the proposal status to be Sent.");
    }

    updates.sent_at = sentAt;
  } else if (canEditHistorical && input.status !== undefined && nextStatus !== "sent") {
    updates.sent_at = null;
  } else if (
    canEditHistorical &&
    input.status === "sent" &&
    input.sentAt === undefined &&
    !proposal.sent_at
  ) {
    updates.sent_at = new Date().toISOString().slice(0, 10);
  }

  if (!Object.keys(updates).length) {
    throw new HttpError(400, "No editable fields were provided.");
  }

  const { error } = await admin.from("grant_proposals").update(updates).eq("id", input.proposalId);

  if (error) {
    throw new HttpError(500, `Could not update proposal: ${error.message}`);
  }

  return getProposalViewById(admin, input.proposalId, input.currentUserId);
}

export async function getAdminQueue(admin: AdminClient, currentUserId: string) {
  const budget = await getCurrentBudgetOrNull(admin);
  if (!budget) {
    return [];
  }
  const votingMemberIds = await getVotingMemberIds(admin);
  const proposalRows = (await loadProposalRowsByYear(admin, budget.budget_year)).filter(
    (row) => row.status === "approved"
  );

  const deps = await loadProposalsWithDependencies(admin, proposalRows);

  return buildProposalViews({
    proposals: proposalRows,
    grantById: deps.grantById,
    organizationById: deps.organizationById,
    votesByProposalId: deps.votesByProposalId,
    currentUserId,
    votingMemberIds
  });
}

export async function getBudgetSnapshot(admin: AdminClient) {
  const budget = await getCurrentBudgetOrNull(admin);
  if (!budget) {
    return emptyFoundationSnapshot().budget;
  }

  const foundation = await getFoundationSnapshot(admin);
  return foundation.budget;
}

export async function importHistoricalProposals(
  admin: AdminClient,
  input: {
    rows: HistoricalProposalImportRow[];
    importedByUserId: string;
  }
) {
  if (!input.rows.length) {
    throw new HttpError(400, "No rows were provided for historical proposal import.");
  }

  const years = unique(input.rows.map((row) => row.budgetYear));
  const { data: existingBudgetRows, error: existingBudgetError } = await admin
    .from("budgets")
    .select("budget_year")
    .in("budget_year", years)
    .returns<Array<{ budget_year: number }>>();

  if (existingBudgetError) {
    throw new HttpError(500, `Could not validate budget years for import: ${existingBudgetError.message}`);
  }

  const existingBudgetYearSet = new Set((existingBudgetRows ?? []).map((row) => row.budget_year));
  const missingBudgetRows = years
    .filter((year) => !existingBudgetYearSet.has(year))
    .map((year) => ({
      budget_year: year,
      annual_fund_size: 0,
      rollover_from_previous_year: 0,
      joint_ratio: 0.75,
      discretionary_ratio: 0.25,
      created_by: input.importedByUserId
    }));

  if (missingBudgetRows.length) {
    const { error: insertBudgetError } = await admin.from("budgets").insert(missingBudgetRows);
    if (insertBudgetError) {
      throw new HttpError(500, `Could not initialize missing budgets: ${insertBudgetError.message}`);
    }
  }

  const { data: organizationRows, error: organizationLookupError } = await admin
    .from("organizations")
    .select("id, name")
    .returns<Array<{ id: string; name: string }>>();

  if (organizationLookupError) {
    throw new HttpError(
      500,
      `Could not load organizations before historical import: ${organizationLookupError.message}`
    );
  }

  const organizationIdByLookup = new Map<string, string>();
  for (const organizationRow of organizationRows ?? []) {
    organizationIdByLookup.set(normalizeLookupValue(organizationRow.name), organizationRow.id);
  }

  const organizationsToCreateByLookup = new Map<
    string,
    {
      name: string;
      website: string | null;
      cause_area: string | null;
      charity_navigator_score: number | null;
    }
  >();

  for (const row of input.rows) {
    const lookup = normalizeLookupValue(row.organizationName);
    if (organizationIdByLookup.has(lookup)) {
      continue;
    }

    const existingDraft = organizationsToCreateByLookup.get(lookup);
    if (existingDraft) {
      if (!existingDraft.website && row.website) {
        existingDraft.website = row.website;
      }
      if (!existingDraft.cause_area && row.causeArea) {
        existingDraft.cause_area = row.causeArea;
      }
      if (existingDraft.charity_navigator_score === null && row.charityNavigatorScore !== undefined) {
        existingDraft.charity_navigator_score = row.charityNavigatorScore;
      }
      continue;
    }

    organizationsToCreateByLookup.set(lookup, {
      name: row.organizationName,
      website: row.website ?? null,
      cause_area: row.causeArea ?? null,
      charity_navigator_score: row.charityNavigatorScore ?? null
    });
  }

  if (organizationsToCreateByLookup.size) {
    const { data: insertedOrganizations, error: insertOrganizationError } = await admin
      .from("organizations")
      .insert([...organizationsToCreateByLookup.values()])
      .select("id, name")
      .returns<Array<{ id: string; name: string }>>();

    if (insertOrganizationError) {
      throw new HttpError(500, `Could not create organizations during import: ${insertOrganizationError.message}`);
    }

    for (const insertedOrganization of insertedOrganizations ?? []) {
      organizationIdByLookup.set(
        normalizeLookupValue(insertedOrganization.name),
        insertedOrganization.id
      );
    }
  }

  const organizationIdsForRows = unique(
    input.rows.map((row) => {
      const organizationId = organizationIdByLookup.get(normalizeLookupValue(row.organizationName));
      if (!organizationId) {
        throw new HttpError(
          500,
          `Organization ID resolution failed for "${row.organizationName}" during import.`
        );
      }
      return organizationId;
    })
  );

  const { data: grantRows, error: grantLookupError } = await admin
    .from("grants_master")
    .select("id, title, organization_id")
    .in("organization_id", organizationIdsForRows)
    .returns<Array<{ id: string; title: string; organization_id: string | null }>>();

  if (grantLookupError) {
    throw new HttpError(500, `Could not load grant records for import: ${grantLookupError.message}`);
  }

  const grantIdByLookup = new Map<string, string>();
  for (const grantRow of grantRows ?? []) {
    if (!grantRow.organization_id) {
      continue;
    }
    grantIdByLookup.set(
      `${grantRow.organization_id}::${normalizeLookupValue(grantRow.title)}`,
      grantRow.id
    );
  }

  const grantsToCreateByLookup = new Map<
    string,
    {
      title: string;
      description: string;
      cause_area: string;
      organization_id: string;
      created_by: string;
    }
  >();

  for (const row of input.rows) {
    const organizationId = organizationIdByLookup.get(normalizeLookupValue(row.organizationName));
    if (!organizationId) {
      continue;
    }

    const grantLookup = `${organizationId}::${normalizeLookupValue(row.title)}`;
    if (grantIdByLookup.has(grantLookup)) {
      continue;
    }

    const existingDraft = grantsToCreateByLookup.get(grantLookup);
    if (existingDraft) {
      if (!existingDraft.description && row.description) {
        existingDraft.description = row.description;
      }
      if (existingDraft.cause_area === "General" && row.causeArea) {
        existingDraft.cause_area = row.causeArea;
      }
      continue;
    }

    grantsToCreateByLookup.set(grantLookup, {
      title: row.title,
      description: row.description,
      cause_area: row.causeArea ?? "General",
      organization_id: organizationId,
      created_by: input.importedByUserId
    });
  }

  if (grantsToCreateByLookup.size) {
    const { data: insertedGrants, error: insertGrantError } = await admin
      .from("grants_master")
      .insert([...grantsToCreateByLookup.values()])
      .select("id, title, organization_id")
      .returns<Array<{ id: string; title: string; organization_id: string | null }>>();

    if (insertGrantError) {
      throw new HttpError(500, `Could not create grant records during import: ${insertGrantError.message}`);
    }

    for (const insertedGrant of insertedGrants ?? []) {
      if (!insertedGrant.organization_id) {
        continue;
      }

      grantIdByLookup.set(
        `${insertedGrant.organization_id}::${normalizeLookupValue(insertedGrant.title)}`,
        insertedGrant.id
      );
    }
  }

  const uniqueGrantIds = unique(
    input.rows.map((row) => {
      const organizationId = organizationIdByLookup.get(normalizeLookupValue(row.organizationName));
      if (!organizationId) {
        throw new HttpError(
          500,
          `Organization resolution failed for "${row.organizationName}" while linking proposals.`
        );
      }

      const grantId = grantIdByLookup.get(
        `${organizationId}::${normalizeLookupValue(row.title)}`
      );
      if (!grantId) {
        throw new HttpError(500, `Grant resolution failed for "${row.title}" during import.`);
      }

      return grantId;
    })
  );

  const { data: existingProposalRows, error: existingProposalLookupError } = await admin
    .from("grant_proposals")
    .select("grant_master_id, budget_year, status, proposal_type")
    .in("grant_master_id", uniqueGrantIds)
    .in("budget_year", years)
    .returns<
      Array<{
        grant_master_id: string;
        budget_year: number;
        status: ProposalStatus;
        proposal_type: ProposalType;
      }>
    >();

  if (existingProposalLookupError) {
    throw new HttpError(
      500,
      `Could not load existing historical proposals for deduplication: ${existingProposalLookupError.message}`
    );
  }

  const existingProposalKeySet = new Set<string>();
  for (const row of existingProposalRows ?? []) {
    existingProposalKeySet.add(
      `${row.grant_master_id}::${row.budget_year}::${row.status}::${row.proposal_type}`
    );
  }

  const proposalRowsToInsert: Array<{
    grant_master_id: string;
    organization_id: string;
    proposer_id: string;
    budget_year: number;
    proposal_type: ProposalType;
    allocation_mode: AllocationMode;
    status: ProposalStatus;
    reveal_votes: boolean;
    final_amount: number;
    notes: string | null;
    sent_at?: string | null;
    created_at?: string;
  }> = [];

  let skippedCount = 0;

  for (const row of input.rows) {
    const organizationId = organizationIdByLookup.get(normalizeLookupValue(row.organizationName));
    if (!organizationId) {
      throw new HttpError(500, `Organization resolution failed for "${row.organizationName}".`);
    }

    const grantId = grantIdByLookup.get(`${organizationId}::${normalizeLookupValue(row.title)}`);
    if (!grantId) {
      throw new HttpError(500, `Grant resolution failed for "${row.title}".`);
    }

    const proposalKey = `${grantId}::${row.budgetYear}::${row.status}::${row.proposalType}`;
    if (existingProposalKeySet.has(proposalKey)) {
      skippedCount += 1;
      continue;
    }

    const proposalRow: {
      grant_master_id: string;
      organization_id: string;
      proposer_id: string;
      budget_year: number;
      proposal_type: ProposalType;
      allocation_mode: AllocationMode;
      status: ProposalStatus;
      reveal_votes: boolean;
      final_amount: number;
      notes: string | null;
      sent_at?: string | null;
      created_at?: string;
    } = {
      grant_master_id: grantId,
      organization_id: organizationId,
      proposer_id: input.importedByUserId,
      budget_year: row.budgetYear,
      proposal_type: row.proposalType,
      allocation_mode: row.proposalType === "joint" ? "sum" : row.allocationMode,
      status: row.status,
      reveal_votes: true,
      final_amount: Math.max(0, roundCurrency(row.finalAmount)),
      notes: row.notes || null
    };

    if (row.sentAt) {
      proposalRow.sent_at = row.sentAt;
    }

    if (row.createdAt) {
      proposalRow.created_at = row.createdAt;
    }

    proposalRowsToInsert.push(proposalRow);
    existingProposalKeySet.add(proposalKey);
  }

  if (proposalRowsToInsert.length) {
    const { error: insertProposalError } = await admin
      .from("grant_proposals")
      .insert(proposalRowsToInsert);

    if (insertProposalError) {
      throw new HttpError(
        500,
        `Could not insert imported historical proposals: ${insertProposalError.message}`
      );
    }
  }

  return {
    insertedCount: proposalRowsToInsert.length,
    skippedCount
  };
}

export async function updateBudget(
  admin: AdminClient,
  input: {
    year: number;
    totalAmount: number;
    rolloverFromPreviousYear: number;
    jointRatio: number;
    discretionaryRatio: number;
    updatedByUserId: string;
  }
) {
  const { data, error } = await admin
    .from("budgets")
    .upsert(
      {
        budget_year: input.year,
        annual_fund_size: Math.max(0, Math.round(input.totalAmount)),
        rollover_from_previous_year: Math.max(0, Math.round(input.rolloverFromPreviousYear)),
        joint_ratio: input.jointRatio,
        discretionary_ratio: input.discretionaryRatio,
        created_by: input.updatedByUserId
      },
      { onConflict: "budget_year" }
    )
    .select(
      "id, budget_year, annual_fund_size, rollover_from_previous_year, joint_ratio, discretionary_ratio, meeting_reveal_enabled"
    )
    .single<BudgetRow>();

  if (error || !data) {
    throw new HttpError(500, `Could not save budget: ${error?.message ?? "missing row"}`);
  }

  return data;
}
