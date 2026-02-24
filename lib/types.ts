export type AppRole = "member" | "oversight" | "admin" | "manager";

export type ProposalStatus = "to_review" | "approved" | "sent" | "declined";
export type ProposalType = "joint" | "discretionary";
export type AllocationMode = "average" | "sum";
export type VoteChoice = "yes" | "no" | "acknowledged" | "flagged";
export type DirectionalCategory =
  | "education"
  | "health"
  | "environment"
  | "housing"
  | "food_security"
  | "arts_culture"
  | "international_aid"
  | "other";
export type DirectionalCategorySource = "rule" | "ai" | "manual" | "fallback";

export const DIRECTIONAL_CATEGORIES: DirectionalCategory[] = [
  "arts_culture",
  "education",
  "environment",
  "health",
  "housing",
  "international_aid",
  "food_security",
  "other"
];

export const DIRECTIONAL_CATEGORY_LABELS: Record<DirectionalCategory, string> = {
  arts_culture: "Arts, Culture & Humanities",
  education: "Education",
  environment: "Environment & Animals",
  health: "Health",
  housing: "Human Services",
  international_aid: "International & Foreign Affairs",
  food_security: "Public & Societal Benefit",
  other: "Other"
};

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
  charityNavigatorUrl?: string | null;
  causeArea: string;
  directionalCategory: DirectionalCategory;
  directionalCategorySource: DirectionalCategorySource;
  directionalCategoryConfidence?: number | null;
  directionalCategoryLocked: boolean;
  directionalCategoryUpdatedAt?: string | null;
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
  /** Optional comment when choice is "flagged" (discretionary proposals). */
  flagComment?: string | null;
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
      organizationWebsite?: string | null;
      charityNavigatorUrl?: string | null;
      charityNavigatorScore?: number | null;
      organizationDirectionalCategory: DirectionalCategory;
      voteBreakdown: Array<{
        userId: string;
        choice: VoteChoice;
        allocationAmount: number;
        createdAt: string;
        flagComment?: string | null;
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

export type DonationLedgerSource = "frank_deenie" | "children";

export interface FrankDeenieDonationRow {
  id: string;
  source: DonationLedgerSource;
  date: string;
  type: string;
  name: string;
  memo: string;
  split: string;
  amount: number;
  status: string;
  editable: boolean;
}

export interface FrankDeenieSnapshot {
  year: number | null;
  availableYears: number[];
  includeChildren: boolean;
  totals: {
    frankDeenie: number;
    children: number;
    overall: number;
  };
  rows: FrankDeenieDonationRow[];
}

export interface WorkspaceSnapshot {
  user: UserProfile;
  /** Active foundation budget year (e.g. for "submitted this year" nudges). */
  currentBudgetYear: number;
  /** Number of voting members (for joint implied-share calculation). */
  votingMemberCount: number;
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
    description: string;
    proposalType: ProposalType;
    status: ProposalStatus;
    proposedAmount: number;
    totalRequiredVotes: number;
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

export interface NavigationSummarySnapshot {
  dashboardToReviewCount: number;
  workspaceActionItemsCount: number;
  meetingToReviewCount: number;
  adminApprovedCount: number;
  pendingPolicyNotificationsCount: number;
}

export interface FoundationHistorySnapshot {
  historyByYear: HistoryByYearPoint[];
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

/** One reviewer's status for a policy version (Oversight view). */
export interface PolicyVersionUserReview {
  userName: string | null;
  status: PolicyNotificationStatus;
  flagReason: string | null;
}

/** Policy version with previous/updated diffs and all users' review statuses (Oversight view). */
export interface PolicyVersionWithReviews {
  version: number;
  changedAt: string;
  changedByName: string | null;
  diffs: MandateSectionDiff[];
  reviews: PolicyVersionUserReview[];
}

export interface MandateComment {
  id: string;
  policyDocumentId: string;
  parentId: string | null;
  sectionKey: MandateSectionKey | null;
  quotedText: string | null;
  startOffset: number | null;
  endOffset: number | null;
  body: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolvedByName: string | null;
}

export interface MandatePolicyPageData {
  policy: MandatePolicySnapshot;
  notifications: PolicyChangeNotification[];
  pendingNotificationsCount: number;
  discussionFlags: PolicyDiscussionFlag[];
  /** When current user is Oversight: each version with diffs and all users' acknowledgement/flag/pending. */
  oversightVersionReviews?: PolicyVersionWithReviews[];
  mandateComments: MandateComment[];
}

export type PushNotificationEventType =
  | "proposal_created"
  | "proposal_ready_for_meeting"
  | "proposal_status_changed"
  | "policy_update_published"
  | "proposal_approved_for_admin";

export interface NotificationPreferences {
  pushEnabled: boolean;
  proposalCreated: boolean;
  proposalReadyForMeeting: boolean;
  proposalStatusChanged: boolean;
  policyUpdatePublished: boolean;
  proposalApprovedForAdmin: boolean;
}
