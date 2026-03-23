"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { mutate as globalMutate } from "swr";
import { History, X } from "lucide-react";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveModal, ResponsiveModalContent, useIsMobile } from "@/components/ui/responsive-modal";
import { cn, charityNavigatorRating, currency, parseNumberInput, titleCase } from "@/lib/utils";
import type { ProposalStatus, UserProfile, WorkspaceSnapshot } from "@/lib/types";
import {
  type ProposalView,
  type ProposalDraft,
  type ProposalDetailEditDraft,
  toProposalDraft,
  toProposalDetailEditDraft,
  normalizeDraftNotes,
  amountsDiffer,
  buildRequiredActionSummary,
} from "@/app/(app)/dashboard/dashboard-utils";

const CharityGivingHistory = dynamic(
  () => import("@/components/charity-giving-history").then((mod) => mod.CharityGivingHistory),
  { ssr: false, loading: () => <div className="space-y-3 p-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /><div className="h-24 w-full animate-pulse rounded bg-muted" /></div> }
);
const VoteForm = dynamic(
  () => import("@/components/voting/vote-form").then((m) => m.VoteForm),
  { ssr: false }
);

export type RowMessage = { tone: "success" | "error"; text: string };

const STATUS_OPTIONS: ProposalStatus[] = ["to_review", "approved", "sent", "declined"];

type CharityNavigatorPreviewState =
  | "preview_available"
  | "missing_ein"
  | "no_score"
  | "config_missing"
  | "upstream_error";

interface CharityNavigatorPreviewResponse {
  state: CharityNavigatorPreviewState;
  normalizedUrl: string | null;
  ein: string | null;
  score: number | null;
  organizationName: string | null;
  message?: string;
}

export interface ProposalDetailPanelProps {
  proposalId: string | null;
  proposals: ProposalView[];
  profile: UserProfile;
  workspace: WorkspaceSnapshot | undefined;
  currentCalendarYear: number;
  isHistoricalBulkEditEnabled: boolean;
  canEditHistorical: boolean;
  getDraft: (proposalId: string) => ProposalDraft;
  onUpdateDraft: (proposalId: string, patch: Partial<ProposalDraft>) => void;
  getRowMessage: (proposalId: string) => RowMessage | undefined;
  savingProposalId: string | null;
  onSaveSentDate: (proposal: ProposalView) => Promise<void>;
  onDetailSaveSuccess: (updatedProposal: ProposalView) => void;
  onSetRowMessage: (proposalId: string, message: RowMessage | null) => void;
  onMutateAfterSave: () => void;
  onClose: () => void;
}

async function applyProposalPatch(proposalId: string, payload: Record<string, unknown>): Promise<ProposalView> {
  const response = await fetch(`/api/foundation/proposals/${proposalId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const responseBody = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    throw new Error(String(responseBody.error ?? "Failed to update proposal."));
  }

  const updatedProposal = responseBody.proposal as ProposalView | undefined;
  if (!updatedProposal) {
    throw new Error("Proposal update response did not include the updated proposal.");
  }

  return updatedProposal;
}

export function ProposalDetailPanel({
  proposalId,
  proposals,
  profile,
  workspace,
  currentCalendarYear,
  isHistoricalBulkEditEnabled,
  canEditHistorical,
  getDraft,
  onUpdateDraft,
  getRowMessage,
  savingProposalId,
  onSaveSentDate,
  onDetailSaveSuccess,
  onSetRowMessage,
  onMutateAfterSave,
  onClose,
}: ProposalDetailPanelProps) {
  const isOversight = profile.role === "oversight";
  const canVote = ["member", "oversight"].includes(profile.role);
  const isSmallScreen = useIsMobile();

  const [isDetailEditMode, setIsDetailEditMode] = useState(false);
  const [detailEditDraft, setDetailEditDraft] = useState<ProposalDetailEditDraft | null>(null);
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [detailCharityNavigatorPreview, setDetailCharityNavigatorPreview] =
    useState<CharityNavigatorPreviewResponse | null>(null);
  const [givingHistoryCharity, setGivingHistoryCharity] = useState<{
    name: string;
    organizationId?: string;
  } | null>(null);

  // Reset edit state when panel closes
  useEffect(() => {
    if (proposalId) {
      return;
    }
    setIsDetailEditMode(false);
    setDetailEditDraft(null);
    setIsDetailSaving(false);
  }, [proposalId]);

  // Verify proposal still exists
  useEffect(() => {
    if (!proposalId) {
      return;
    }

    const stillExists = proposals.some((proposal) => proposal.id === proposalId);
    if (!stillExists) {
      onClose();
    }
  }, [proposals, proposalId, onClose]);

  // Fetch Charity Navigator preview on open
  useEffect(() => {
    if (!proposalId) {
      setDetailCharityNavigatorPreview(null);
      return;
    }

    const currentProposal = proposals.find((proposal) => proposal.id === proposalId);
    const charityNavigatorUrl = currentProposal?.charityNavigatorUrl?.trim() ?? "";
    if (!charityNavigatorUrl) {
      setDetailCharityNavigatorPreview(null);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/charity-navigator/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ charityNavigatorUrl })
        });
        if (!response.ok) {
          if (active) {
            setDetailCharityNavigatorPreview(null);
          }
          return;
        }

        const payload = (await response.json()) as CharityNavigatorPreviewResponse;
        if (active) {
          setDetailCharityNavigatorPreview(payload);
        }
      } catch {
        if (active) {
          setDetailCharityNavigatorPreview(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [proposals, proposalId]);

  // Body scroll lock + Escape key handler
  useEffect(() => {
    if (!proposalId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [proposalId, onClose]);

  const updateDetailEditDraft = <K extends keyof ProposalDetailEditDraft>(
    key: K,
    value: ProposalDetailEditDraft[K]
  ) => {
    setDetailEditDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveDetailProposalEdits = useCallback(async () => {
    const detailProposal = proposals.find((p) => p.id === proposalId) ?? null;
    if (!detailProposal || !detailEditDraft || !isOversight) {
      return;
    }

    const isVoteLocked =
      detailProposal.budgetYear === currentCalendarYear && detailProposal.progress.votesSubmitted > 0;
    const payload: Record<string, unknown> = {};

    if (!isVoteLocked) {
      const title = detailEditDraft.title.trim();
      if (!title) {
        toast.error("Title is required.");
        return;
      }
      if (title !== detailProposal.title.trim()) {
        payload.title = title;
      }

      const description = detailEditDraft.description.trim();
      if (!description) {
        toast.error("Description is required.");
        return;
      }
      if (description !== detailProposal.description.trim()) {
        payload.description = description;
      }

      const proposedAmount = parseNumberInput(detailEditDraft.proposedAmount);
      if (proposedAmount === null || proposedAmount < 0) {
        toast.error("Proposed amount must be a non-negative number.");
        return;
      }
      if (amountsDiffer(proposedAmount, detailProposal.proposedAmount)) {
        payload.proposedAmount = proposedAmount;
      }

      const proposalNotes = normalizeDraftNotes(detailProposal.notes ?? "");
      const nextNotes = normalizeDraftNotes(detailEditDraft.notes);
      if (proposalNotes !== nextNotes) {
        payload.notes = nextNotes;
      }
    }

    const website = detailEditDraft.website.trim();
    const proposalWebsite = (detailProposal.organizationWebsite ?? "").trim();
    if (website !== proposalWebsite) {
      payload.website = website || null;
    }

    const charityNavigatorUrl = detailEditDraft.charityNavigatorUrl.trim();
    const proposalCharityNavigatorUrl = (detailProposal.charityNavigatorUrl ?? "").trim();
    if (charityNavigatorUrl !== proposalCharityNavigatorUrl) {
      payload.charityNavigatorUrl = charityNavigatorUrl || null;
    }

    if (!Object.keys(payload).length) {
      toast.error("No changes to save.");
      return;
    }

    setIsDetailSaving(true);
    onSetRowMessage(detailProposal.id, null);

    try {
      const updatedProposal = await applyProposalPatch(detailProposal.id, payload);
      onDetailSaveSuccess(updatedProposal);
      setDetailEditDraft(toProposalDetailEditDraft(updatedProposal));
      setIsDetailEditMode(false);
      onSetRowMessage(detailProposal.id, { tone: "success", text: "Proposal details updated." });

      mutateAllFoundation();
      void globalMutate("/api/navigation/summary");
      void globalMutate("/api/workspace");
      onMutateAfterSave();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Failed to update proposal details."
      );
    } finally {
      setIsDetailSaving(false);
    }
  }, [proposals, proposalId, detailEditDraft, isOversight, currentCalendarYear, onDetailSaveSuccess, onSetRowMessage, onMutateAfterSave]);

  // Derived values
  const detailProposal = proposalId
    ? proposals.find((proposal) => proposal.id === proposalId) ?? null
    : null;
  const detailDraft = detailProposal ? getDraft(detailProposal.id) : null;
  const detailMasked = Boolean(detailProposal?.progress.masked && detailProposal.status === "to_review" && detailProposal.proposalType !== "discretionary");
  const detailRequiredAction = detailProposal
    ? buildRequiredActionSummary(detailProposal, profile.role)
    : null;
  const detailShowVoteForm =
    canVote &&
    detailProposal?.status === "to_review" &&
    !detailProposal?.progress.hasCurrentUserVoted;
  const detailCanOversightEditProposal = Boolean(isOversight && detailProposal);
  const detailIsOwnProposal = Boolean(detailProposal && detailProposal.proposerId === profile.id);
  const detailIsVoteLocked = Boolean(
    detailCanOversightEditProposal &&
      detailProposal &&
      detailProposal.budgetYear === currentCalendarYear &&
      detailProposal.progress.votesSubmitted > 0
  );
  const detailCanEditNonUrlFields = detailCanOversightEditProposal && !detailIsVoteLocked;
  const detailIsRowEditable = Boolean(detailProposal && isHistoricalBulkEditEnabled);
  const detailCanEditSentDate = Boolean(
    detailProposal &&
      (detailIsRowEditable || (!canEditHistorical && detailIsOwnProposal && detailProposal.status === "sent"))
  );
  const detailSentDateDisabled = detailProposal
    ? detailIsRowEditable
      ? detailDraft?.status !== "sent"
      : !detailCanEditSentDate
    : true;
  const detailParsedDraftFinalAmount = detailDraft ? parseNumberInput(detailDraft.finalAmount) : null;
  const detailParsedDraftProposedAmount = detailEditDraft
    ? parseNumberInput(detailEditDraft.proposedAmount)
    : null;
  const detailRowState = detailProposal ? getRowMessage(detailProposal.id) : undefined;
  const detailApiOrganizationName = detailCharityNavigatorPreview?.organizationName?.trim() || null;

  return (
    <>
      <ResponsiveModal
        open={!!(detailProposal && detailDraft && detailRequiredAction)}
        onOpenChange={(open) => { if (!open) onClose(); }}
      >
        {detailProposal && detailDraft && detailRequiredAction ? (
        <ResponsiveModalContent
          aria-labelledby="proposal-details-title"
          dialogClassName={cn(
            "rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overflow-x-hidden",
            !isSmallScreen && detailShowVoteForm ? "sm:max-w-5xl" : "sm:max-w-3xl"
          )}
          showCloseButton={false}
          footer={
            isSmallScreen && detailShowVoteForm ? (
              <VoteForm
                proposalId={detailProposal.id}
                proposalType={detailProposal.proposalType}
                proposedAmount={detailProposal.proposedAmount}
                totalRequiredVotes={detailProposal.progress.totalRequiredVotes}
                userId={profile.id}
                proposalTitle={detailProposal.title}
                onSuccess={() => {}}
                maxJointAllocation={
                  detailProposal.proposalType === "joint" && workspace
                    ? workspace.personalBudget.jointRemaining +
                      workspace.personalBudget.discretionaryRemaining
                    : undefined
                }
              />
            ) : null
          }
        >
            <div className={cn(!isSmallScreen && detailShowVoteForm && "flex items-start gap-6")}>
            <div className={cn(!isSmallScreen && detailShowVoteForm && "flex-1 min-w-0")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {detailMasked && detailProposal?.proposalType !== "joint" && detailProposal?.proposalType !== "discretionary"
                    ? "Blind"
                    : (detailProposal?.proposalType === "joint" || detailProposal?.proposalType === "discretionary") && detailProposal?.status === "to_review"
                    ? currency(detailProposal.proposedAmount)
                    : currency(detailProposal.progress.computedFinalAmount)}
                </p>
                <DialogTitle id="proposal-details-title" className="mt-1 text-base font-semibold leading-snug">
                  {detailProposal.title}
                </DialogTitle>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                aria-label="Close proposal details"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge className={detailProposal.proposalType === "joint"
                ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
                : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
              }>
                {titleCase(detailProposal.proposalType)}
              </Badge>
              <StatusPill status={detailProposal.status} />
              {detailProposal.organizationName && detailProposal.organizationName !== "Unknown Organization" && detailProposal.organizationName !== detailProposal.title ? (
                <span className="text-sm text-muted-foreground">{detailProposal.organizationName}</span>
              ) : null}
              <button
                type="button"
                onClick={() => setGivingHistoryCharity({
                  name: detailProposal.organizationName || detailProposal.title,
                  organizationId: detailProposal.organizationId
                })}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <History className="h-3 w-3" />
                Giving history
              </button>
            </div>

            <div className="my-4 h-px bg-border" />

            <dl className="grid gap-4 rounded-xl border border-border bg-muted/60 p-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date Sent</dt>
                <dd className="mt-1.5 font-semibold text-foreground">
                  {detailProposal.sentAt
                    ? new Date(detailProposal.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proposed By</dt>
                <dd className="mt-1.5 font-semibold text-foreground">
                  {detailProposal.proposerDisplayName}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</dt>
                <dd className="mt-1.5 whitespace-pre-wrap font-semibold text-foreground">
                  {detailProposal.description?.trim() || "—"}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Organization Website</dt>
                <dd className="mt-1.5 text-foreground">
                  {detailProposal.organizationWebsite ? (
                    <a
                      href={detailProposal.organizationWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                    >
                      {detailProposal.organizationWebsite}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Charity Navigator URL</dt>
                <dd className="mt-1.5 text-foreground">
                  {detailProposal.charityNavigatorUrl ? (
                    <>
                      <a
                        href={detailProposal.charityNavigatorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                      >
                        {detailProposal.charityNavigatorUrl}
                      </a>
                      {detailProposal.charityNavigatorScore != null ? (
                        <div className="mt-2 rounded-lg border border-border/70 bg-muted/50 p-2.5 text-xs">
                          <p className="font-medium text-foreground">
                            {detailApiOrganizationName
                              ? `${detailApiOrganizationName}'s score is `
                              : "This charity's score is "}
                            {Math.round(detailProposal.charityNavigatorScore)}%, earning it a{" "}
                            {charityNavigatorRating(detailProposal.charityNavigatorScore).starLabel} rating.
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {charityNavigatorRating(detailProposal.charityNavigatorScore).meaning}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted-foreground">Score not yet available.</p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Add the Charity Navigator URL to autopopulate the charity&apos;s score.
                    </span>
                  )}
                </dd>
              </div>
              {detailProposal.notes?.trim() ? (
                <div className="md:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</dt>
                  <dd className="mt-1.5 whitespace-pre-wrap font-semibold text-foreground">{detailProposal.notes.trim()}</dd>
                </div>
              ) : null}
            </dl>

            {detailIsRowEditable || detailCanEditSentDate ? (
              <>
              <div className="mt-5 flex items-center gap-2">
                <div className="h-px flex-1 bg-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Edit</span>
                <div className="h-px flex-1 bg-muted" />
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {detailIsRowEditable ? (
                  <label className="text-xs font-semibold text-muted-foreground">
                    Amount
                    <AmountInput
                      min={0}
                      step="0.01"
                      value={detailDraft.finalAmount}
                      onChange={(event) =>
                        onUpdateDraft(detailProposal.id, { finalAmount: event.target.value })
                      }
                      className="mt-1"
                    />
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Amount preview:{" "}
                      {detailParsedDraftFinalAmount !== null && detailParsedDraftFinalAmount >= 0
                        ? currency(detailParsedDraftFinalAmount)
                        : "Invalid amount"}
                    </span>
                  </label>
                ) : null}

                {detailIsRowEditable ? (
                  <label className="text-xs font-semibold text-muted-foreground">
                    Status
                    <select
                      value={detailDraft.status}
                      onChange={(event) =>
                        onUpdateDraft(detailProposal.id, {
                          status: event.target.value as ProposalStatus,
                          ...(event.target.value === "sent" ? {} : { sentAt: "" })
                        })
                      }
                      className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-md border px-3 py-1 text-base outline-none md:text-sm mt-1"
                    >
                      {STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {titleCase(statusOption)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {detailCanEditSentDate ? (
                  <label className="text-xs font-semibold text-muted-foreground">
                    Date amount sent
                    <Input
                      type="date"
                      value={detailDraft.sentAt}
                      disabled={detailSentDateDisabled}
                      onChange={(event) => onUpdateDraft(detailProposal.id, { sentAt: event.target.value })}
                      className="mt-1"
                    />
                  </label>
                ) : null}

                {detailIsRowEditable ? (
                  <label className="text-xs font-semibold text-muted-foreground md:col-span-2">
                    Notes
                    <Input
                      type="text"
                      value={detailDraft.notes}
                      onChange={(event) => onUpdateDraft(detailProposal.id, { notes: event.target.value })}
                      placeholder="Optional notes"
                      className="mt-1"
                    />
                  </label>
                ) : null}
              </div>
              </>
            ) : null}

            {detailCanOversightEditProposal && isDetailEditMode && detailEditDraft ? (
              <>
                <div className="mt-5 flex items-center gap-2">
                  <div className="h-px flex-1 bg-muted" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Proposal Content & Links
                  </span>
                  <div className="h-px flex-1 bg-muted" />
                </div>
                {detailIsVoteLocked ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Votes have already been submitted for this active-year proposal. Only URL fields can be updated.
                  </p>
                ) : null}
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Proposal title
                    <Input
                      type="text"
                      value={detailEditDraft.title}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("title", event.target.value)}
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Proposed amount
                    <AmountInput
                      min={0}
                      step="0.01"
                      value={detailEditDraft.proposedAmount}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("proposedAmount", event.target.value)}
                      className="mt-1"
                    />
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Amount preview:{" "}
                      {detailParsedDraftProposedAmount !== null && detailParsedDraftProposedAmount >= 0
                        ? currency(detailParsedDraftProposedAmount)
                        : "Invalid amount"}
                    </span>
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground md:col-span-2">
                    Description
                    <Textarea
                      value={detailEditDraft.description}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("description", event.target.value)}
                      className="mt-1 min-h-20"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground md:col-span-2">
                    Notes
                    <Input
                      type="text"
                      value={detailEditDraft.notes}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("notes", event.target.value)}
                      placeholder="Optional notes"
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground md:col-span-2">
                    Organization website URL
                    <Input
                      type="text"
                      value={detailEditDraft.website}
                      disabled={isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("website", event.target.value)}
                      className="mt-1"
                      placeholder="e.g. prepforprep.org or https://example.org"
                    />
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      You can enter just the domain; we&apos;ll add https:// if needed.
                    </span>
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground md:col-span-2">
                    Charity Navigator URL
                    <Input
                      type="text"
                      value={detailEditDraft.charityNavigatorUrl}
                      disabled={isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("charityNavigatorUrl", event.target.value)}
                      className="mt-1"
                      placeholder="e.g. charitynavigator.org/... or full URL"
                    />
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      You can enter just the domain or full URL; we&apos;ll add https:// if needed.
                    </span>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailEditDraft(toProposalDetailEditDraft(detailProposal));
                      setIsDetailEditMode(false);
                    }}
                    disabled={isDetailSaving}
                  >
                    Cancel edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void saveDetailProposalEdits()}
                    disabled={isDetailSaving}
                  >
                    {isDetailSaving ? "Saving..." : "Save proposal changes"}
                  </Button>
                </div>
              </>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {detailRequiredAction.href && detailRequiredAction.ctaLabel ? (
                <Link
                  href={detailRequiredAction.href}
                  className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  {detailRequiredAction.ctaLabel}
                </Link>
              ) : null}
              {detailCanOversightEditProposal ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDetailSaving}
                  onClick={() => {
                    if (isDetailEditMode) {
                      setIsDetailEditMode(false);
                      return;
                    }
                    setDetailEditDraft(toProposalDetailEditDraft(detailProposal));
                    setIsDetailEditMode(true);
                  }}
                >
                  {isDetailEditMode ? "Close edit" : "Edit proposal"}
                </Button>
              ) : null}
              {!canEditHistorical && detailIsOwnProposal && detailProposal.status === "sent" ? (
                <Button
                  size="sm"
                  disabled={savingProposalId === detailProposal.id}
                  onClick={() => void onSaveSentDate(detailProposal)}
                >
                  {savingProposalId === detailProposal.id ? "Saving..." : "Save date"}
                </Button>
              ) : null}
            </div>


            {detailRowState ? (
              <p
                className={`mt-3 text-xs ${
                  detailRowState.tone === "error"
                    ? "text-rose-600"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {detailRowState.text}
              </p>
            ) : null}
            </div>
            {!isSmallScreen && detailShowVoteForm ? (
              <div className="w-80 shrink-0 border-l pl-6 pt-1">
                <VoteForm
                  proposalId={detailProposal.id}
                  proposalType={detailProposal.proposalType}
                  proposedAmount={detailProposal.proposedAmount}
                  totalRequiredVotes={detailProposal.progress.totalRequiredVotes}
                  userId={profile.id}
                  proposalTitle={detailProposal.title}
                  onSuccess={() => {}}
                  maxJointAllocation={
                    detailProposal.proposalType === "joint" && workspace
                      ? workspace.personalBudget.jointRemaining +
                        workspace.personalBudget.discretionaryRemaining
                      : undefined
                  }
                  className="border-t-0 pt-0"
                />
              </div>
            ) : null}
            </div>
        </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>

      <ResponsiveModal
        open={!!givingHistoryCharity}
        onOpenChange={(open) => { if (!open) setGivingHistoryCharity(null); }}
      >
        {givingHistoryCharity ? (
          <ResponsiveModalContent
            aria-labelledby="giving-history-title"
            dialogClassName="rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl"
            showCloseButton={false}
          >
            <CharityGivingHistory
              charityName={givingHistoryCharity.name}
              organizationId={givingHistoryCharity.organizationId}
              primarySource="children"
              onBack={() => setGivingHistoryCharity(null)}
            />
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>
    </>
  );
}
