export type AppRole = "member" | "oversight" | "admin" | "manager";

export type ProposalStatus = "to_review" | "approved" | "sent" | "declined";
export type ProposalType = "joint" | "discretionary";
export type AllocationMode = "average" | "sum";
export type VoteChoice = "yes" | "no";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: AppRole;
}

export interface Organization {
  id: string;
  name: string;
  website: string;
  charityNavigatorScore: number;
  causeArea: string;
}

export interface GrantMaster {
  id: string;
  title: string;
  description: string;
  causeArea: string;
  organizationId: string;
}

export interface Budget {
  id: string;
  year: number;
  totalAmount: number;
  jointRatio: number;
  discretionaryRatio: number;
  rolloverFromPreviousYear: number;
  meetingRevealEnabled: boolean;
}

export interface GrantProposal {
  id: string;
  grantMasterId: string;
  organizationId: string;
  title: string;
  description: string;
  proposerId: string;
  budgetYear: number;
  proposalType: ProposalType;
  allocationMode: AllocationMode;
  status: ProposalStatus;
  revealVotes: boolean;
  createdAt: string;
}

export interface Vote {
  id: string;
  proposalId: string;
  userId: string;
  choice: VoteChoice;
  allocationAmount: number;
  createdAt: string;
}

export interface ProposalProgress {
  totalRequiredVotes: number;
  votesSubmitted: number;
  hasCurrentUserVoted: boolean;
  masked: boolean;
  computedFinalAmount: number;
  isReadyForMeeting: boolean;
}

export interface FoundationSnapshot {
  budget: {
    year: number;
    total: number;
    jointPool: number;
    discretionaryPool: number;
    jointAllocated: number;
    discretionaryAllocated: number;
    jointRemaining: number;
    discretionaryRemaining: number;
    rolloverFromPreviousYear: number;
  };
  proposals: Array<
    GrantProposal & {
      progress: ProposalProgress;
      organizationName: string;
      voteBreakdown: Array<{
        userId: string;
        choice: VoteChoice;
        allocationAmount: number;
        createdAt: string;
      }>;
    }
  >;
  historyByYear: Array<{ year: number; totalDonated: number }>;
  annualCycle: {
    resetDate: string;
    yearEndDeadline: string;
    monthHint: string;
  };
}

export interface WorkspaceSnapshot {
  user: UserProfile;
  personalBudget: {
    jointTarget: number;
    jointAllocated: number;
    jointRemaining: number;
    discretionaryCap: number;
    discretionaryAllocated: number;
    discretionaryRemaining: number;
  };
  actionItems: Array<{
    proposalId: string;
    title: string;
    proposalType: ProposalType;
    voteProgressLabel: string;
  }>;
  voteHistory: Array<{
    proposalId: string;
    proposalTitle: string;
    choice: VoteChoice;
    amount: number;
    at: string;
  }>;
  submittedGifts: Array<GrantProposal>;
}
