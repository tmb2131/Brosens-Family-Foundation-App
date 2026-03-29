export interface ProposalDraftPayload {
  organizationName: string;
  description: string;
  website: string;
  charityNavigatorUrl: string;
  proposalType: string;
  proposedAmount: string;
  proposerAllocationAmount: string;
}

export interface ProposalDraft extends ProposalDraftPayload {
  savedAt: number;
}
