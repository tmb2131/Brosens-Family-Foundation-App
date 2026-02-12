export type AppRole = "member" | "oversight" | "admin" | "manager";

export type ProposalStatus = "to_review" | "approved" | "sent" | "declined";
export type ProposalType = "joint" | "discretionary";
export type AllocationMode = "average" | "sum";
export type VoteChoice = "yes" | "no" | "acknowledged" | "flagged";

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
  proposedAmount: number;
  status: ProposalStatus;
  revealVotes: boolean;
  notes?: string | null;
  sentAt?: string | null;
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

export interface HistoryByYearPoint {
  year: number;
  totalDonated: number;
  jointSent: number;
  discretionarySent: number;
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
  historyByYear: HistoryByYearPoint[];
  availableBudgetYears?: number[];
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

export type PolicyNotificationStatus = "pending" | "acknowledged" | "flagged";

export type MandateSectionKey =
  | "missionStatement"
  | "structure"
  | "jointGivingPolicy"
  | "discretionaryGivingPolicy"
  | "process"
  | "annualCycle"
  | "rolesAndResponsibilities"
  | "references";

export interface MandatePolicyContent {
  missionStatement: string;
  structure: string;
  jointGivingPolicy: string;
  discretionaryGivingPolicy: string;
  process: string;
  annualCycle: string;
  rolesAndResponsibilities: string;
  references: string;
}

export interface MandateSectionDiff {
  key: MandateSectionKey;
  label: string;
  before: string;
  after: string;
}

export interface MandatePolicySnapshot {
  slug: string;
  title: string;
  version: number;
  content: MandatePolicyContent;
  updatedAt: string;
  updatedByName: string | null;
}

export interface PolicyChangeNotification {
  id: string;
  changeId: string;
  status: PolicyNotificationStatus;
  flagReason: string | null;
  handledAt: string | null;
  createdAt: string;
  version: number;
  changedAt: string;
  changedByName: string | null;
  diffs: MandateSectionDiff[];
}

export interface PolicyDiscussionFlag {
  id: string;
  userId: string;
  userName: string | null;
  changeId: string;
  version: number;
  changedAt: string;
  flaggedAt: string;
  reason: string;
}

export interface MandatePolicyPageData {
  policy: MandatePolicySnapshot;
  notifications: PolicyChangeNotification[];
  pendingNotificationsCount: number;
  discussionFlags: PolicyDiscussionFlag[];
}
