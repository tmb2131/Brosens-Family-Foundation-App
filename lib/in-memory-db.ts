import {
  AllocationMode,
  Budget,
  FoundationSnapshot,
  GrantMaster,
  GrantProposal,
  HistoryByYearPoint,
  Organization,
  ProposalType,
  UserProfile,
  Vote,
  VoteChoice,
  WorkspaceSnapshot
} from "@/lib/types";

const VOTING_MEMBER_IDS = ["peter", "charlie", "tom", "john"];

function isoNow(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return d.toISOString();
}

interface DataState {
  users: UserProfile[];
  organizations: Organization[];
  grantsMaster: GrantMaster[];
  budgets: Budget[];
  proposals: GrantProposal[];
  votes: Vote[];
  historicalDonations: HistoryByYearPoint[];
}

function currentYear() {
  return new Date().getFullYear();
}

const seedState: DataState = {
  users: [
    { id: "peter", name: "Peter", email: "peter@brosens.foundation", role: "member" },
    { id: "charlie", name: "Charlie", email: "charlie@brosens.foundation", role: "member" },
    { id: "tom", name: "Tom", email: "tom@brosens.foundation", role: "oversight" },
    { id: "john", name: "John", email: "john@brosens.foundation", role: "member" },
    { id: "brynn", name: "Brynn", email: "brynn@brosens.foundation", role: "admin" },
    { id: "dad", name: "Dad", email: "dad@brosens.foundation", role: "manager" }
  ],
  organizations: [
    {
      id: "org-1",
      name: "National Food Bank Network",
      website: "https://example.org/food-bank",
      charityNavigatorScore: 94,
      causeArea: "Food Security",
      directionalCategory: "housing",
      directionalCategorySource: "rule",
      directionalCategoryConfidence: 0.91,
      directionalCategoryLocked: false,
      directionalCategoryUpdatedAt: isoNow(-20_000)
    },
    {
      id: "org-2",
      name: "STEM Scholars Alliance",
      website: "https://example.org/stem-scholars",
      charityNavigatorScore: 91,
      causeArea: "Education",
      directionalCategory: "education",
      directionalCategorySource: "rule",
      directionalCategoryConfidence: 0.9,
      directionalCategoryLocked: false,
      directionalCategoryUpdatedAt: isoNow(-20_000)
    },
    {
      id: "org-3",
      name: "Wildlife Recovery Fund",
      website: "https://example.org/wildlife-recovery",
      charityNavigatorScore: 88,
      causeArea: "Environment",
      directionalCategory: "environment",
      directionalCategorySource: "rule",
      directionalCategoryConfidence: 0.9,
      directionalCategoryLocked: false,
      directionalCategoryUpdatedAt: isoNow(-20_000)
    },
    {
      id: "org-4",
      name: "Emergency Housing Partners",
      website: "https://example.org/emergency-housing",
      charityNavigatorScore: 90,
      causeArea: "Housing",
      directionalCategory: "housing",
      directionalCategorySource: "rule",
      directionalCategoryConfidence: 0.9,
      directionalCategoryLocked: false,
      directionalCategoryUpdatedAt: isoNow(-20_000)
    }
  ],
  grantsMaster: [
    {
      id: "grant-1",
      title: "Food Bank Expansion",
      description: "Scale regional food distribution for underserved counties.",
      causeArea: "Food Security",
      organizationId: "org-1"
    },
    {
      id: "grant-2",
      title: "STEM Scholarship Cohort",
      description: "Fund annual scholarships for first-generation students.",
      causeArea: "Education",
      organizationId: "org-2"
    },
    {
      id: "grant-3",
      title: "Wildlife Habitat Recovery",
      description: "Restore habitats impacted by wildfire and drought.",
      causeArea: "Environment",
      organizationId: "org-3"
    },
    {
      id: "grant-4",
      title: "Emergency Housing Relief",
      description: "Rapid assistance for families facing immediate displacement.",
      causeArea: "Housing",
      organizationId: "org-4"
    }
  ],
  budgets: [
    {
      id: "budget-current",
      year: currentYear(),
      totalAmount: 24_000_000,
      jointRatio: 0.75,
      discretionaryRatio: 0.25,
      rolloverFromPreviousYear: 1_200_000,
      meetingRevealEnabled: false
    }
  ],
  proposals: [
    {
      id: "proposal-1",
      grantMasterId: "grant-2",
      organizationId: "org-2",
      title: "STEM Scholarship Cohort",
      description: "Pilot 20 scholarships with mentorship support.",
      proposerId: "charlie",
      budgetYear: currentYear(),
      proposalType: "joint",
      allocationMode: "average",
      proposedAmount: 2_400_000,
      status: "to_review",
      revealVotes: false,
      createdAt: isoNow(-500)
    },
    {
      id: "proposal-2",
      grantMasterId: "grant-1",
      organizationId: "org-1",
      title: "Food Bank Expansion",
      description: "Add two refrigerated vehicles and one warehouse lease.",
      proposerId: "peter",
      budgetYear: currentYear(),
      proposalType: "discretionary",
      allocationMode: "sum",
      proposedAmount: 700_000,
      status: "approved",
      revealVotes: true,
      createdAt: isoNow(-700)
    },
    {
      id: "proposal-3",
      grantMasterId: "grant-3",
      organizationId: "org-3",
      title: "Wildlife Habitat Recovery",
      description: "Re-seeding and long-term habitat monitoring program.",
      proposerId: "tom",
      budgetYear: currentYear(),
      proposalType: "joint",
      allocationMode: "sum",
      proposedAmount: 1_800_000,
      status: "to_review",
      revealVotes: false,
      createdAt: isoNow(-250)
    },
    {
      id: "proposal-4",
      grantMasterId: "grant-4",
      organizationId: "org-4",
      title: "Emergency Housing Relief",
      description: "Bridge support for emergency shelter and legal assistance.",
      proposerId: "john",
      budgetYear: currentYear(),
      proposalType: "discretionary",
      allocationMode: "sum",
      proposedAmount: 500_000,
      status: "declined",
      revealVotes: true,
      createdAt: isoNow(-900)
    }
  ],
  votes: [
    {
      id: "vote-1",
      proposalId: "proposal-1",
      userId: "peter",
      choice: "yes",
      allocationAmount: 1_100_000,
      createdAt: isoNow(-450)
    },
    {
      id: "vote-2",
      proposalId: "proposal-1",
      userId: "tom",
      choice: "yes",
      allocationAmount: 1_000_000,
      createdAt: isoNow(-430)
    },
    {
      id: "vote-3",
      proposalId: "proposal-2",
      userId: "peter",
      choice: "yes",
      allocationAmount: 350_000,
      createdAt: isoNow(-680)
    },
    {
      id: "vote-4",
      proposalId: "proposal-2",
      userId: "charlie",
      choice: "yes",
      allocationAmount: 200_000,
      createdAt: isoNow(-670)
    },
    {
      id: "vote-5",
      proposalId: "proposal-2",
      userId: "tom",
      choice: "no",
      allocationAmount: 0,
      createdAt: isoNow(-669)
    },
    {
      id: "vote-6",
      proposalId: "proposal-2",
      userId: "john",
      choice: "yes",
      allocationAmount: 150_000,
      createdAt: isoNow(-668)
    },
    {
      id: "vote-7",
      proposalId: "proposal-3",
      userId: "john",
      choice: "yes",
      allocationAmount: 600_000,
      createdAt: isoNow(-220)
    },
    {
      id: "vote-8",
      proposalId: "proposal-4",
      userId: "peter",
      choice: "no",
      allocationAmount: 0,
      createdAt: isoNow(-880)
    },
    {
      id: "vote-9",
      proposalId: "proposal-4",
      userId: "charlie",
      choice: "no",
      allocationAmount: 0,
      createdAt: isoNow(-875)
    },
    {
      id: "vote-10",
      proposalId: "proposal-4",
      userId: "tom",
      choice: "no",
      allocationAmount: 0,
      createdAt: isoNow(-870)
    }
  ],
  historicalDonations: [
    {
      year: currentYear() - 3,
      totalDonated: 16_800_000,
      jointSent: 12_600_000,
      discretionarySent: 4_200_000
    },
    {
      year: currentYear() - 2,
      totalDonated: 18_200_000,
      jointSent: 13_650_000,
      discretionarySent: 4_550_000
    },
    {
      year: currentYear() - 1,
      totalDonated: 20_000_000,
      jointSent: 15_000_000,
      discretionarySent: 5_000_000
    },
    {
      year: currentYear(),
      totalDonated: 17_500_000,
      jointSent: 13_125_000,
      discretionarySent: 4_375_000
    }
  ]
};

const globalForState = globalThis as unknown as { __foundation_state?: DataState };

function db(): DataState {
  if (!globalForState.__foundation_state) {
    globalForState.__foundation_state = structuredClone(seedState);
  }
  return globalForState.__foundation_state;
}

function findCurrentBudget() {
  const state = db();
  const year = currentYear();
  return (
    state.budgets.find((budget) => budget.year === year) ??
    state.budgets[state.budgets.length - 1]
  );
}

function proposalVotes(proposalId: string) {
  return db().votes.filter((vote) => vote.proposalId === proposalId);
}

function computeFinalAmount(
  proposal: GrantProposal,
  votes: Vote[]
): number {
  if (proposal.proposalType === "joint") {
    return votes.reduce((sum, vote) => sum + vote.allocationAmount, 0);
  }

  return Math.max(0, Math.round(proposal.proposedAmount));
}

function getRequiredVotesForProposal(proposal: GrantProposal) {
  if (proposal.proposalType === "joint") {
    return VOTING_MEMBER_IDS.length;
  }

  return VOTING_MEMBER_IDS.filter((id) => id !== proposal.proposerId).length;
}

function getEligibleVotesForProposal(proposal: GrantProposal, votes: Vote[]) {
  if (proposal.proposalType === "joint") {
    return votes.filter((vote) => VOTING_MEMBER_IDS.includes(vote.userId));
  }

  return votes.filter(
    (vote) => VOTING_MEMBER_IDS.includes(vote.userId) && vote.userId !== proposal.proposerId
  );
}

function withProgress(proposal: GrantProposal, userId?: string, revealOverride = false) {
  const org = db().organizations.find((item) => item.id === proposal.organizationId);
  const votes = getEligibleVotesForProposal(proposal, proposalVotes(proposal.id));
  const requiredVotes = getRequiredVotesForProposal(proposal);
  const votesSubmitted = votes.length;
  const hasCurrentUserVoted = userId
    ? proposal.proposalType === "discretionary" && userId === proposal.proposerId
      ? true
      : votes.some((vote) => vote.userId === userId)
    : false;
  const masked = !(revealOverride || proposal.revealVotes || hasCurrentUserVoted);

  return {
    ...proposal,
    organizationName: org?.name ?? "Unknown Organization",
    organizationWebsite: org?.website ?? null,
    charityNavigatorUrl: org?.charityNavigatorUrl ?? null,
    organizationDirectionalCategory: org?.directionalCategory ?? "other",
    voteBreakdown: votes.map((vote) => ({
      userId: vote.userId,
      choice: vote.choice,
      allocationAmount: vote.allocationAmount,
      createdAt: vote.createdAt,
      flagComment: vote.flagComment
    })),
    progress: {
      totalRequiredVotes: requiredVotes,
      votesSubmitted,
      hasCurrentUserVoted,
      masked,
      computedFinalAmount: computeFinalAmount(proposal, votes),
      isReadyForMeeting: votesSubmitted >= requiredVotes
    }
  };
}

function aggregateBudgetUsage() {
  const budget = findCurrentBudget();
  const proposals = db().proposals.filter(
    (proposal) => proposal.budgetYear === budget.year && proposal.status !== "declined"
  );

  let jointAllocated = 0;
  let discretionaryAllocated = 0;

  for (const proposal of proposals) {
    const total = computeFinalAmount(proposal, getEligibleVotesForProposal(proposal, proposalVotes(proposal.id)));
    if (proposal.proposalType === "joint") {
      jointAllocated += total;
    } else {
      discretionaryAllocated += total;
    }
  }

  const total = budget.totalAmount + budget.rolloverFromPreviousYear;
  const jointPool = Math.round(total * budget.jointRatio);
  const discretionaryPool = Math.round(total * budget.discretionaryRatio);

  return {
    budget,
    total,
    jointPool,
    discretionaryPool,
    jointAllocated,
    discretionaryAllocated,
    jointRemaining: Math.max(0, jointPool - jointAllocated),
    discretionaryRemaining: Math.max(0, discretionaryPool - discretionaryAllocated)
  };
}

export function getUsers() {
  return db().users;
}

export function getUserById(userId: string) {
  return db().users.find((user) => user.id === userId);
}

export function getUserByEmail(email: string) {
  return db().users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function getFoundationSnapshot(currentUserId?: string): FoundationSnapshot {
  const budget = aggregateBudgetUsage();
  const proposals = db()
    .proposals
    .filter((proposal) => proposal.budgetYear === budget.budget.year)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((proposal) => withProgress(proposal, currentUserId, false));

  const now = new Date();
  const resetDate = new Date(Date.UTC(now.getUTCFullYear(), 1, 1));
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));

  return {
    budget: {
      year: budget.budget.year,
      total: budget.total,
      jointPool: budget.jointPool,
      discretionaryPool: budget.discretionaryPool,
      jointAllocated: budget.jointAllocated,
      discretionaryAllocated: budget.discretionaryAllocated,
      jointRemaining: budget.jointRemaining,
      discretionaryRemaining: budget.discretionaryRemaining,
      rolloverFromPreviousYear: budget.budget.rolloverFromPreviousYear
    },
    proposals,
    historyByYear: db().historicalDonations,
    annualCycle: {
      resetDate: resetDate.toISOString().slice(0, 10),
      yearEndDeadline: yearEnd.toISOString().slice(0, 10),
      monthHint:
        now.getUTCMonth() === 0
          ? "January review period: define areas of improvement before Feb 1 reset."
          : now.getUTCMonth() === 1
          ? "February active cycle: budget reset is in effect."
          : "In-cycle mode: allocations continue until Dec 31 year-end close."
    }
  };
}

export function getWorkspaceSnapshot(userId: string): WorkspaceSnapshot | null {
  const user = getUserById(userId);
  if (!user) {
    return null;
  }

  const budget = aggregateBudgetUsage();
  const userVotes = db().votes.filter((vote) => vote.userId === userId);

  const personalJointTarget = Math.round(budget.jointPool / VOTING_MEMBER_IDS.length);
  const personalDiscretionaryCap = Math.min(
    5_000_000,
    Math.round(budget.discretionaryPool / VOTING_MEMBER_IDS.length)
  );

  const totalJointVoteAmountByUser = userVotes
    .filter((vote) => {
      const proposal = db().proposals.find((item) => item.id === vote.proposalId);
      return proposal?.proposalType === "joint" && proposal.status !== "declined";
    })
    .reduce((sum, vote) => sum + vote.allocationAmount, 0);

  const jointAllocatedByUser = Math.min(totalJointVoteAmountByUser, personalJointTarget);
  const jointOverflowToDiscretionary = Math.max(
    0,
    totalJointVoteAmountByUser - personalJointTarget
  );

  const discretionaryProposedByUser = db()
    .proposals
    .filter(
      (proposal) =>
        proposal.budgetYear === budget.budget.year &&
        proposal.proposalType === "discretionary" &&
        proposal.proposerId === userId &&
        proposal.status !== "declined"
    )
    .reduce((sum, proposal) => sum + proposal.proposedAmount, 0);

  const discretionaryAllocatedByUser =
    discretionaryProposedByUser + jointOverflowToDiscretionary;

  const toReview = db()
    .proposals
    .filter((proposal) => proposal.status === "to_review" && VOTING_MEMBER_IDS.includes(userId))
    .filter((proposal) => !withProgress(proposal, userId).progress.hasCurrentUserVoted)
    .map((proposal) => {
      const progress = withProgress(proposal, userId).progress;

      return {
        proposalId: proposal.id,
        title: proposal.title,
        description: proposal.description,
        proposalType: proposal.proposalType,
        status: proposal.status,
        proposedAmount: proposal.proposedAmount,
        totalRequiredVotes: progress.totalRequiredVotes,
        voteProgressLabel: `${progress.votesSubmitted} of ${progress.totalRequiredVotes} votes in`
      };
    });

  const voteHistory = userVotes
    .map((vote) => {
      const proposal = db().proposals.find((item) => item.id === vote.proposalId);
      return {
        proposalId: vote.proposalId,
        proposalTitle: proposal?.title ?? "Unknown Proposal",
        choice: vote.choice,
        amount: vote.allocationAmount,
        at: vote.createdAt
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  const submittedGifts = db()
    .proposals
    .filter((proposal) => proposal.proposerId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    user,
    votingMemberCount: VOTING_MEMBER_IDS.length,
    personalBudget: {
      jointTarget: personalJointTarget,
      jointAllocated: jointAllocatedByUser,
      jointRemaining: Math.max(0, personalJointTarget - jointAllocatedByUser),
      discretionaryCap: personalDiscretionaryCap,
      discretionaryAllocated: discretionaryAllocatedByUser,
      discretionaryRemaining: Math.max(0, personalDiscretionaryCap - discretionaryAllocatedByUser)
    },
    actionItems: toReview,
    voteHistory,
    submittedGifts
  };
}

export function submitProposal(input: {
  title: string;
  description: string;
  organizationId: string;
  proposalType: ProposalType;
  allocationMode: AllocationMode;
  proposedAmount: number;
  proposerId: string;
}) {
  const state = db();
  const budget = findCurrentBudget();

  const matchingGrant = state.grantsMaster.find(
    (grant) => grant.organizationId === input.organizationId && grant.title === input.title
  );

  const grantId = matchingGrant?.id ?? `grant-${state.grantsMaster.length + 1}`;
  if (!matchingGrant) {
    state.grantsMaster.push({
      id: grantId,
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      causeArea: "General"
    });
  }

  const proposal: GrantProposal = {
    id: `proposal-${state.proposals.length + 1}`,
    grantMasterId: grantId,
    organizationId: input.organizationId,
    title: input.title,
    description: input.description,
    proposerId: input.proposerId,
    budgetYear: budget.year,
    proposalType: input.proposalType,
    allocationMode: input.proposalType === "joint" ? "sum" : input.allocationMode,
    proposedAmount: Math.max(0, Math.round(input.proposedAmount)),
    status: "to_review",
    revealVotes: false,
    createdAt: isoNow()
  };

  state.proposals.push(proposal);

  return proposal;
}

export function submitVote(input: {
  proposalId: string;
  userId: string;
  choice: VoteChoice;
  allocationAmount: number;
  flagComment?: string | null;
}) {
  const state = db();
  const proposal = state.proposals.find((item) => item.id === input.proposalId);
  if (!proposal) {
    throw new Error("Proposal not found.");
  }

  if (proposal.status !== "to_review") {
    throw new Error("Votes can only be submitted while proposal is To Review.");
  }

  if (!VOTING_MEMBER_IDS.includes(input.userId)) {
    throw new Error("Only voting members can cast votes.");
  }

  if (proposal.proposalType === "discretionary" && input.userId === proposal.proposerId) {
    throw new Error("Discretionary proposer cannot vote on their own proposal.");
  }

  const allowedChoices: VoteChoice[] =
    proposal.proposalType === "joint" ? ["yes", "no"] : ["acknowledged", "flagged"];
  if (!allowedChoices.includes(input.choice)) {
    throw new Error(
      proposal.proposalType === "joint"
        ? 'Joint proposals accept only "yes" or "no" votes.'
        : 'Discretionary proposals accept only "acknowledged" or "flagged" votes.'
    );
  }

  const normalizedAllocation =
    proposal.proposalType === "joint" && input.choice === "yes"
      ? Math.max(0, Math.round(input.allocationAmount))
      : 0;

  const existing = state.votes.find(
    (vote) => vote.proposalId === input.proposalId && vote.userId === input.userId
  );

  const flagComment =
    input.choice === "flagged" && input.flagComment != null && input.flagComment.trim() !== ""
      ? input.flagComment.trim()
      : null;

  if (existing) {
    existing.choice = input.choice;
    existing.allocationAmount = normalizedAllocation;
    existing.createdAt = isoNow();
    existing.flagComment = flagComment ?? undefined;
  } else {
    state.votes.push({
      id: `vote-${state.votes.length + 1}`,
      proposalId: input.proposalId,
      userId: input.userId,
      choice: input.choice,
      allocationAmount: normalizedAllocation,
      createdAt: isoNow(),
      flagComment: flagComment ?? undefined
    });
  }

  return withProgress(proposal, input.userId);
}

export function setProposalRevealState(input: { proposalId: string; reveal: boolean }) {
  const proposal = db().proposals.find((item) => item.id === input.proposalId);
  if (!proposal) {
    throw new Error("Proposal not found.");
  }

  proposal.revealVotes = input.reveal;
  return withProgress(proposal, undefined, input.reveal);
}

export function setProposalDecision(input: {
  proposalId: string;
  status: "approved" | "declined" | "sent";
}) {
  const proposal = db().proposals.find((item) => item.id === input.proposalId);
  if (!proposal) {
    throw new Error("Proposal not found.");
  }

  proposal.status = input.status;
  proposal.revealVotes = true;

  return withProgress(proposal);
}

export function updateBudget(input: {
  year: number;
  totalAmount: number;
  rolloverFromPreviousYear: number;
  jointRatio: number;
  discretionaryRatio: number;
}) {
  const state = db();
  const existing = state.budgets.find((budget) => budget.year === input.year);

  if (existing) {
    existing.totalAmount = Math.max(0, Math.round(input.totalAmount));
    existing.rolloverFromPreviousYear = Math.max(0, Math.round(input.rolloverFromPreviousYear));
    existing.jointRatio = input.jointRatio;
    existing.discretionaryRatio = input.discretionaryRatio;
    return existing;
  }

  const newBudget: Budget = {
    id: `budget-${state.budgets.length + 1}`,
    year: input.year,
    totalAmount: Math.max(0, Math.round(input.totalAmount)),
    rolloverFromPreviousYear: Math.max(0, Math.round(input.rolloverFromPreviousYear)),
    jointRatio: input.jointRatio,
    discretionaryRatio: input.discretionaryRatio,
    meetingRevealEnabled: false
  };

  state.budgets.push(newBudget);
  return newBudget;
}

export function getOrganizations() {
  return db().organizations;
}

export function getProposalsForMeeting() {
  return db()
    .proposals
    .filter((proposal) => proposal.status === "to_review")
    .map((proposal) => withProgress(proposal));
}

export function getAdminQueue() {
  return db()
    .proposals
    .filter((proposal) => proposal.status === "approved")
    .map((proposal) => withProgress(proposal));
}

export function getVotingMemberIds() {
  return VOTING_MEMBER_IDS;
}
