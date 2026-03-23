import { formatNumber, parseNumberInput } from "@/lib/utils";
import type { AppRole, FoundationSnapshot, ProposalStatus } from "@/lib/types";

export type ProposalView = FoundationSnapshot["proposals"][number];

export interface ProposalDraft {
  status: ProposalStatus;
  finalAmount: string;
  sentAt: string;
  notes: string;
}

export interface ProposalDetailEditDraft {
  title: string;
  description: string;
  proposedAmount: string;
  notes: string;
  website: string;
  charityNavigatorUrl: string;
}

export interface RequiredActionSummary {
  owner: string;
  detail: string;
  tone: "neutral" | "attention" | "complete";
  href?: string;
  ctaLabel?: string;
  /** When true, CTA should open the proposal detail modal (e.g. to submit vote) instead of navigating. */
  openDetail?: boolean;
}

export function toAmountInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function toProposalDraft(proposal: ProposalView): ProposalDraft {
  return {
    status: proposal.status,
    finalAmount: toAmountInput(proposal.progress.computedFinalAmount),
    sentAt: proposal.sentAt ?? "",
    notes: proposal.notes ?? ""
  };
}

export function toProposalDetailEditDraft(proposal: ProposalView): ProposalDetailEditDraft {
  return {
    title: proposal.title,
    description: proposal.description,
    proposedAmount: toAmountInput(proposal.proposedAmount),
    notes: proposal.notes ?? "",
    website: proposal.organizationWebsite ?? "",
    charityNavigatorUrl: proposal.charityNavigatorUrl ?? ""
  };
}

export function normalizeDraftNotes(notes: string): string | null {
  const trimmed = notes.trim();
  return trimmed ? trimmed : null;
}

export function normalizeDraftSentAt(draft: ProposalDraft): string | null {
  if (draft.status !== "sent") {
    return null;
  }

  const trimmed = draft.sentAt.trim();
  return trimmed ? trimmed : null;
}

export function amountsDiffer(left: number, right: number): boolean {
  return Math.abs(left - right) > 0.009;
}

export function buildRequiredActionSummary(
  proposal: ProposalView,
  viewerRole?: AppRole
): RequiredActionSummary {
  if (proposal.status === "to_review") {
    const remainingVotes = Math.max(
      proposal.progress.totalRequiredVotes - proposal.progress.votesSubmitted,
      0
    );

    if (remainingVotes > 0) {
      const memberLabel = remainingVotes === 1 ? "member" : "members";
      const voteDetail =
        proposal.proposalType === "joint"
          ? `${formatNumber(remainingVotes)} voting ${memberLabel} still need to submit their allocations.`
          : `${formatNumber(remainingVotes)} voting ${memberLabel} still need to submit acknowledgement/flag votes.`;
      const viewerCanVote = viewerRole === "member" || viewerRole === "oversight";
      const viewerNeedsToVote = viewerCanVote && !proposal.progress.hasCurrentUserVoted;

      if (viewerNeedsToVote) {
        return {
          owner: "You",
          detail: `Submit your vote. ${voteDetail}`,
          tone: "attention",
          ctaLabel: proposal.proposalType === "joint" ? "Enter vote & amount" : "Enter vote",
          openDetail: true
        };
      }

      return {
        owner: "Voting members",
        detail: voteDetail,
        tone: "attention"
      };
    }

    const needsViewerAction = viewerRole === "oversight" || viewerRole === "manager";
    return {
      owner: "Oversight/Manager",
      detail: "Record Approved or Declined in Meeting.",
      tone: needsViewerAction ? "attention" : "neutral",
      href: "/meeting",
      ctaLabel: "Open Meeting"
    };
  }

  if (proposal.status === "approved") {
    return {
      owner: "Admin",
      detail: "Mark as Sent in Admin after funds are disbursed.",
      tone: viewerRole === "admin" ? "attention" : "neutral",
      href: "/admin",
      ctaLabel: "Open Admin Queue"
    };
  }

  if (proposal.status === "sent") {
    return {
      owner: "None",
      detail: "Completed. No action required.",
      tone: "complete"
    };
  }

  return {
    owner: "None",
    detail: "Closed. No action required.",
    tone: "complete"
  };
}

export function buildPendingActionRequiredLabel(proposal: ProposalView): string {
  const summary = buildRequiredActionSummary(proposal);
  if (summary.owner === "None") {
    return summary.detail;
  }
  return `${summary.owner}: ${summary.detail}`;
}

export function isHistoricalDraftDirty(proposal: ProposalView, draft: ProposalDraft): boolean {
  const parsedFinalAmount = parseNumberInput(draft.finalAmount);
  if (parsedFinalAmount === null || parsedFinalAmount < 0) {
    return true;
  }

  const proposalNotes = normalizeDraftNotes(proposal.notes ?? "");
  const draftNotes = normalizeDraftNotes(draft.notes);
  const proposalSentAt = proposal.sentAt ?? null;
  const draftSentAt = normalizeDraftSentAt(draft);

  return (
    proposal.status !== draft.status ||
    amountsDiffer(parsedFinalAmount, proposal.progress.computedFinalAmount) ||
    proposalNotes !== draftNotes ||
    proposalSentAt !== draftSentAt
  );
}

export function buildHistoricalUpdatePayload(draft: ProposalDraft): {
  payload: Record<string, unknown> | null;
  error?: string;
} {
  const finalAmount = parseNumberInput(draft.finalAmount);
  if (finalAmount === null || finalAmount < 0) {
    return {
      payload: null,
      error: "Final amount must be a non-negative number."
    };
  }

  return {
    payload: {
      status: draft.status,
      finalAmount,
      notes: draft.notes,
      sentAt: normalizeDraftSentAt(draft)
    } as Record<string, unknown>
  };
}
