export interface ProposalDraftPayload {
  organizationName: string;
  description: string;
  website: string;
  charityNavigatorUrl: string;
  /** Optional: drafts saved before manual score entry don't have it. */
  charityNavigatorScore?: string;
  proposalType: string;
  proposedAmount: string;
  proposerAllocationAmount: string;
}

export interface ProposalDraft extends ProposalDraftPayload {
  savedAt: number;
}
