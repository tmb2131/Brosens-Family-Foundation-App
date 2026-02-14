"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ChevronDown, DollarSign, Download, MoreHorizontal, PieChart, Plus, Users, Wallet, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { DataTableHeadRow, DataTableRow, DataTableSortButton } from "@/components/ui/data-table";
import { FilterPanel } from "@/components/ui/filter-panel";
import { MetricCard } from "@/components/ui/metric-card";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal";
import { currency, formatNumber, parseNumberInput, titleCase, toISODate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";

const HistoricalImpactChart = dynamic(
  () => import("@/components/dashboard/historical-impact-chart").then((mod) => mod.HistoricalImpactChart),
  { ssr: false, loading: () => <div className="h-[220px] w-full" /> }
);
import { AppRole, FoundationSnapshot, ProposalStatus } from "@/lib/types";
import { VoteForm } from "@/components/voting/vote-form";

const STATUS_OPTIONS: ProposalStatus[] = ["to_review", "approved", "sent", "declined"];

type ProposalView = FoundationSnapshot["proposals"][number];
type DashboardTab = "tracker" | "pending";
type SelectedYear = number | "all" | null;

interface PendingResponse {
  proposals: FoundationSnapshot["proposals"];
}

interface ProposalDraft {
  status: ProposalStatus;
  finalAmount: string;
  sentAt: string;
  notes: string;
}

interface ProposalDetailEditDraft {
  title: string;
  description: string;
  proposedAmount: string;
  notes: string;
  website: string;
  charityNavigatorUrl: string;
}

interface RequiredActionSummary {
  owner: string;
  detail: string;
  tone: "neutral" | "attention" | "complete";
  href?: string;
  ctaLabel?: string;
}

type SortKey = "proposal" | "type" | "amount" | "status" | "sentAt" | "notes";
type SortDirection = "asc" | "desc";

interface TableFilters {
  proposal: string;
  proposalType: "all" | "joint" | "discretionary";
  status: "all" | ProposalStatus;
}

interface ProposalExportRow {
  proposal: string;
  description: string;
  type: string;
  amount: string;
  status: string;
  sentAt: string;
  notes: string;
  requiredAction: string;
}

const DEFAULT_FILTERS: TableFilters = {
  proposal: "",
  proposalType: "all",
  status: "all"
};

const STATUS_RANK: Record<ProposalStatus, number> = {
  to_review: 0,
  approved: 1,
  sent: 2,
  declined: 3
};

const EXPORT_HEADERS = [
  "Proposal",
  "Description",
  "Type",
  "Amount",
  "Status",
  "Date Amount Sent",
  "Notes",
  "Required Action"
] as const;

function toAmountInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toProposalDraft(proposal: ProposalView): ProposalDraft {
  return {
    status: proposal.status,
    finalAmount: toAmountInput(proposal.progress.computedFinalAmount),
    sentAt: proposal.sentAt ?? "",
    notes: proposal.notes ?? ""
  };
}

function toProposalDetailEditDraft(proposal: ProposalView): ProposalDetailEditDraft {
  return {
    title: proposal.title,
    description: proposal.description,
    proposedAmount: toAmountInput(proposal.proposedAmount),
    notes: proposal.notes ?? "",
    website: proposal.organizationWebsite ?? "",
    charityNavigatorUrl: proposal.charityNavigatorUrl ?? ""
  };
}

function normalizeDraftNotes(notes: string) {
  const trimmed = notes.trim();
  return trimmed ? trimmed : null;
}

function normalizeDraftSentAt(draft: ProposalDraft) {
  if (draft.status !== "sent") {
    return null;
  }

  const trimmed = draft.sentAt.trim();
  return trimmed ? trimmed : null;
}

function amountsDiffer(left: number, right: number) {
  return Math.abs(left - right) > 0.009;
}

function buildRequiredActionSummary(
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
          ? `${formatNumber(remainingVotes)} voting ${memberLabel} still need to submit allocations.`
          : `${formatNumber(remainingVotes)} voting ${memberLabel} still need to submit acknowledgement/flag votes.`;
      const viewerCanVote = viewerRole === "member" || viewerRole === "oversight";
      const viewerNeedsToVote = viewerCanVote && !proposal.progress.hasCurrentUserVoted;

      if (viewerNeedsToVote) {
        return {
          owner: "You",
          detail: `Submit your vote. ${voteDetail}`,
          tone: "attention"
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

function buildPendingActionRequiredLabel(proposal: ProposalView) {
  const summary = buildRequiredActionSummary(proposal);
  if (summary.owner === "None") {
    return summary.detail;
  }
  return `${summary.owner}: ${summary.detail}`;
}

function isHistoricalDraftDirty(proposal: ProposalView, draft: ProposalDraft) {
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

function buildHistoricalUpdatePayload(draft: ProposalDraft) {
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

function escapeCsvField(value: string) {
  const nextValue = value.replace(/"/g, '""');
  return /[",\n]/.test(nextValue) ? `"${nextValue}"` : nextValue;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rowToExportValues(row: ProposalExportRow) {
  return [
    row.proposal,
    row.description,
    row.type,
    row.amount,
    row.status,
    row.sentAt,
    row.notes,
    row.requiredAction
  ];
}

function buildCsv(rows: ProposalExportRow[]) {
  const headerLine = EXPORT_HEADERS.join(",");
  const dataLines = rows.map((row) => rowToExportValues(row).map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function buildTsv(rows: ProposalExportRow[]) {
  const sanitize = (value: string) => value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  const headerLine = EXPORT_HEADERS.join("\t");
  const dataLines = rows.map((row) => rowToExportValues(row).map(sanitize).join("\t"));
  return [headerLine, ...dataLines].join("\n");
}

function buildExcelHtml(rows: ProposalExportRow[], title: string, subtitle: string) {
  const head = EXPORT_HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = rowToExportValues(row).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      h1 { margin: 0 0 6px; font-size: 18px; }
      p { margin: 0 0 12px; color: #555; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d4d4d8; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
      th { background: #f4f4f5; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body>
</html>`;
}

function buildPrintableHtml(rows: ProposalExportRow[], title: string, subtitle: string) {
  const head = EXPORT_HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = rowToExportValues(row).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 0.5in; }
      body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; }
      h1 { margin: 0 0 6px; font-size: 18px; }
      p { margin: 0 0 12px; color: #475569; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: left; vertical-align: top; }
      th { background: #e2e8f0; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body>
</html>`;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isOversight = user?.role === "oversight";
  const [selectedYear, setSelectedYear] = useState<SelectedYear>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("pending");
  const [drafts, setDrafts] = useState<Record<string, ProposalDraft>>({});
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("proposal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [savingProposalId, setSavingProposalId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<
    Record<string, { tone: "success" | "error"; text: string }>
  >({});
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [detailProposalId, setDetailProposalId] = useState<string | null>(null);
  const [isDetailEditMode, setIsDetailEditMode] = useState(false);
  const [detailEditDraft, setDetailEditDraft] = useState<ProposalDetailEditDraft | null>(null);
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [detailEditError, setDetailEditError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [exportMessage, setExportMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const foundationKey = useMemo(() => {
    if (!user) {
      return null;
    }

    if (selectedYear === null) {
      return "/api/foundation";
    }

    if (selectedYear === "all") {
      return "/api/foundation?allYears=1";
    }

    return `/api/foundation?budgetYear=${selectedYear}`;
  }, [selectedYear, user]);

  const { data, isLoading, error, mutate } = useSWR<FoundationSnapshot>(foundationKey);
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    error: pendingError,
    mutate: mutatePending
  } = useSWR<PendingResponse>(isOversight ? "/api/foundation/pending" : null, {
    refreshInterval: 30_000
  });

  const availableYears = useMemo(() => {
    if (!data) {
      return [];
    }

    const years = data.availableBudgetYears ?? [data.budget.year];
    return [...new Set(years)].sort((a, b) => b - a);
  }, [data]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (selectedYear === null) {
      setSelectedYear(data.budget.year);
      return;
    }

    if (selectedYear !== "all" && !availableYears.includes(selectedYear)) {
      setSelectedYear(data.budget.year);
    }
  }, [availableYears, data, selectedYear]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setDrafts(
      Object.fromEntries(data.proposals.map((proposal) => [proposal.id, toProposalDraft(proposal)]))
    );
  }, [data]);

  useEffect(() => {
    if (!isOversight) {
      setActiveTab("tracker");
    }
  }, [isOversight]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (exportMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsExportMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isExportMenuOpen]);

  const filteredAndSortedProposals = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedProposalFilter = filters.proposal.trim().toLowerCase();

    const filtered = data.proposals.filter((proposal) => {
      const searchableProposalText = `${proposal.title} ${proposal.description}`.toLowerCase();

      if (normalizedProposalFilter && !searchableProposalText.includes(normalizedProposalFilter)) {
        return false;
      }

      if (filters.proposalType !== "all" && proposal.proposalType !== filters.proposalType) {
        return false;
      }

      if (filters.status !== "all" && proposal.status !== filters.status) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "proposal") {
        comparison = a.title.localeCompare(b.title);
      } else if (sortKey === "type") {
        comparison = a.proposalType.localeCompare(b.proposalType);
      } else if (sortKey === "amount") {
        comparison = a.progress.computedFinalAmount - b.progress.computedFinalAmount;
      } else if (sortKey === "status") {
        comparison = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      } else if (sortKey === "sentAt") {
        comparison = (a.sentAt ?? "").localeCompare(b.sentAt ?? "");
      } else if (sortKey === "notes") {
        comparison = (a.notes ?? "").localeCompare(b.notes ?? "");
      }

      if (comparison === 0) {
        comparison = a.title.localeCompare(b.title);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [data, filters, sortDirection, sortKey]);

  const pendingProposals = useMemo(() => {
    if (!pendingData) {
      return [];
    }

    return [...pendingData.proposals]
      .filter((proposal) => proposal.status !== "sent" && proposal.status !== "declined")
      .sort((a, b) => {
        if (a.budgetYear !== b.budgetYear) {
          return b.budgetYear - a.budgetYear;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [pendingData]);

  const currentCalendarYear = new Date().getFullYear();
  const isAllYearsView = selectedYear === "all";
  const selectedBudgetYear =
    typeof selectedYear === "number" ? selectedYear : data?.budget.year ?? currentCalendarYear;
  const selectedBudgetYearLabel = isAllYearsView ? "all budget years" : `budget year ${selectedBudgetYear}`;
  const selectedYearFilterValue =
    selectedYear === "all" ? "all" : String(selectedYear ?? selectedBudgetYear);
  const canVote = Boolean(user && ["member", "oversight"].includes(user.role));
  const isHistoricalView = !isAllYearsView && selectedBudgetYear < currentCalendarYear;
  const canEditHistorical = Boolean(user?.role === "oversight" && isHistoricalView);
  const allowHistoricalBulkEdit = false;
  const isHistoricalBulkEditEnabled = allowHistoricalBulkEdit && canEditHistorical && isBulkEditMode;
  const showPendingTab = isOversight && activeTab === "pending";
  const totalAllocatedForYear = data
    ? data.budget.jointAllocated + data.budget.discretionaryAllocated
    : 0;
  const jointUtilization = data && data.budget.jointPool > 0
    ? (data.budget.jointAllocated / data.budget.jointPool) * 100
    : 0;
  const discretionaryUtilization = data && data.budget.discretionaryPool > 0
    ? (data.budget.discretionaryAllocated / data.budget.discretionaryPool) * 100
    : 0;

  useEffect(() => {
    if (!canEditHistorical || !allowHistoricalBulkEdit) {
      setIsBulkEditMode(false);
      setBulkMessage(null);
    }
  }, [allowHistoricalBulkEdit, canEditHistorical]);

  useEffect(() => {
    if (showPendingTab) {
      setDetailProposalId(null);
    }
  }, [showPendingTab]);

  useEffect(() => {
    if (!detailProposalId) {
      return;
    }

    const stillExists = data?.proposals.some((proposal) => proposal.id === detailProposalId) ?? false;
    if (!stillExists) {
      setDetailProposalId(null);
    }
  }, [data, detailProposalId]);

  useEffect(() => {
    if (detailProposalId) {
      return;
    }
    setIsDetailEditMode(false);
    setDetailEditDraft(null);
    setIsDetailSaving(false);
    setDetailEditError(null);
  }, [detailProposalId]);

  useEffect(() => {
    if (!detailProposalId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailProposalId(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [detailProposalId]);

  const dirtyHistoricalProposalIds = useMemo(() => {
    if (!canEditHistorical || !data) {
      return [];
    }

    return data.proposals
      .filter((proposal) => {
        const draft = drafts[proposal.id] ?? toProposalDraft(proposal);
        return isHistoricalDraftDirty(proposal, draft);
      })
      .map((proposal) => proposal.id);
  }, [canEditHistorical, data, drafts]);
  const dirtyHistoricalCount = dirtyHistoricalProposalIds.length;

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading foundation dashboard...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-sm text-rose-600">
        Failed to load dashboard{error ? `: ${error.message}` : "."}
      </p>
    );
  }

  const setFilter = <K extends keyof TableFilters>(key: K, value: TableFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setExportMessage(null);
    setIsExportMenuOpen(false);
  };
  const exportRows: ProposalExportRow[] = filteredAndSortedProposals.map((proposal) => {
    const masked = proposal.progress.masked && proposal.status === "to_review";
    const requiredAction = buildRequiredActionSummary(proposal, user?.role);
    const requiredActionLabel =
      requiredAction.owner === "None"
        ? requiredAction.detail
        : `${requiredAction.owner}: ${requiredAction.detail}`;
    return {
      proposal: proposal.title.trim(),
      description: proposal.description.trim(),
      type: titleCase(proposal.proposalType),
      amount: masked ? "Blind until your vote is submitted" : proposal.progress.computedFinalAmount.toFixed(2),
      status: titleCase(proposal.status),
      sentAt: proposal.sentAt ?? "",
      notes: proposal.notes?.trim() ?? "",
      requiredAction: requiredActionLabel
    };
  });
  const exportFilenameBase = `dashboard-grant-tracker-${isAllYearsView ? "all-years" : `year-${selectedBudgetYear}`}-${toISODate(new Date())}`;
  const exportTitle = "Dashboard Grant Tracker";
  const exportSubtitle = `${isAllYearsView ? "All budget years" : `Budget Year ${selectedBudgetYear}`} | ${formatNumber(exportRows.length)} rows`;
  const clearTrackerFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setExportMessage(null);
    setIsExportMenuOpen(false);
  };

  const toggleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  };

  const sortMarker = (key: SortKey) => {
    if (sortKey !== key) {
      return "";
    }
    return sortDirection === "asc" ? " ^" : " v";
  };

  const updateDraft = (proposalId: string, patch: Partial<ProposalDraft>) => {
    setDrafts((current) => ({
      ...current,
      [proposalId]: {
        ...current[proposalId],
        ...patch
      }
    }));
    setBulkMessage(null);
    setRowMessage((current) => {
      if (!current[proposalId]) {
        return current;
      }

      const next = { ...current };
      delete next[proposalId];
      return next;
    });
  };

  const applyProposalPatch = async (proposalId: string, payload: Record<string, unknown>) => {
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
  };

  const saveProposalSentDate = async (proposal: ProposalView) => {
    const draft = drafts[proposal.id];
    if (!draft) {
      return;
    }

    setSavingProposalId(proposal.id);
    setBulkMessage(null);
    setRowMessage((current) => {
      const next = { ...current };
      delete next[proposal.id];
      return next;
    });

    try {
      const updatedProposal = await applyProposalPatch(proposal.id, {
        sentAt: draft.sentAt.trim() ? draft.sentAt.trim() : null
      });
      setDrafts((current) => ({
        ...current,
        [proposal.id]: toProposalDraft(updatedProposal)
      }));

      setRowMessage((current) => ({
        ...current,
        [proposal.id]: {
          tone: "success",
          text: "Sent date updated."
        }
      }));

      await mutate();
      if (isOversight) {
        await mutatePending();
      }
    } catch (saveError) {
      setRowMessage((current) => ({
        ...current,
        [proposal.id]: {
          tone: "error",
          text:
            saveError instanceof Error ? saveError.message : "Failed to update proposal."
        }
      }));
    } finally {
      setSavingProposalId(null);
    }
  };

  const cancelBulkEdit = () => {
    if (!canEditHistorical) {
      return;
    }

    setDrafts(
      Object.fromEntries(data.proposals.map((proposal) => [proposal.id, toProposalDraft(proposal)]))
    );
    setRowMessage({});
    setBulkMessage(null);
    setIsBulkEditMode(false);
  };

  const saveHistoricalBulk = async () => {
    if (!canEditHistorical || !isHistoricalBulkEditEnabled) {
      return;
    }

    if (!dirtyHistoricalCount) {
      setBulkMessage({
        tone: "success",
        text: "No changes to save."
      });
      return;
    }

    const proposalById = new Map(data.proposals.map((proposal) => [proposal.id, proposal]));
    const validationMessages: Record<string, { tone: "success" | "error"; text: string }> = {};
    const updates: Array<{ proposalId: string; payload: Record<string, unknown> }> = [];

    for (const proposalId of dirtyHistoricalProposalIds) {
      const proposal = proposalById.get(proposalId);
      if (!proposal) {
        continue;
      }

      const draft = drafts[proposalId] ?? toProposalDraft(proposal);
      const { payload, error } = buildHistoricalUpdatePayload(draft);
      if (!payload) {
        validationMessages[proposalId] = {
          tone: "error",
          text: error ?? "Invalid row values."
        };
        continue;
      }

      updates.push({ proposalId, payload });
    }

    setRowMessage((current) => {
      const next = { ...current };
      for (const proposalId of dirtyHistoricalProposalIds) {
        delete next[proposalId];
      }
      return {
        ...next,
        ...validationMessages
      };
    });

    if (!updates.length) {
      setBulkMessage({
        tone: "error",
        text: "Bulk save blocked. Fix row errors and try again."
      });
      return;
    }

    setIsBulkSaving(true);
    setBulkMessage(null);

    try {
      const results: Array<
        { proposalId: string; updatedProposal: ProposalView } | { proposalId: string; error: unknown }
      > = await Promise.all(
        updates.map(async (update) => {
          try {
            const updatedProposal = await applyProposalPatch(update.proposalId, update.payload);
            return {
              proposalId: update.proposalId,
              updatedProposal
            };
          } catch (error) {
            return {
              proposalId: update.proposalId,
              error
            };
          }
        })
      );

      let savedCount = 0;
      let failedCount = 0;
      const resultMessages: Record<string, { tone: "success" | "error"; text: string }> = {
        ...validationMessages
      };
      const draftUpdates: Record<string, ProposalDraft> = {};
      for (const result of results) {
        if ("error" in result) {
          failedCount += 1;
          resultMessages[result.proposalId] = {
            tone: "error",
            text:
              result.error instanceof Error ? result.error.message : "Failed to update proposal."
          };
          continue;
        }

        savedCount += 1;
        draftUpdates[result.proposalId] = toProposalDraft(result.updatedProposal);
        resultMessages[result.proposalId] = {
          tone: "success",
          text: "Saved."
        };
      }

      if (Object.keys(draftUpdates).length) {
        setDrafts((current) => ({
          ...current,
          ...draftUpdates
        }));
      }

      setRowMessage((current) => {
        const next = { ...current };
        for (const proposalId of dirtyHistoricalProposalIds) {
          delete next[proposalId];
        }
        return {
          ...next,
          ...resultMessages
        };
      });

      const validationErrorCount = Object.keys(validationMessages).length;
      if (savedCount > 0 && failedCount === 0 && validationErrorCount === 0) {
        setBulkMessage({
          tone: "success",
          text: `Saved ${formatNumber(savedCount)} historical proposal${savedCount === 1 ? "" : "s"}.`
        });
        setIsBulkEditMode(false);
      } else if (savedCount > 0) {
        const issueCount = failedCount + validationErrorCount;
        setBulkMessage({
          tone: "error",
          text: `Saved ${formatNumber(savedCount)} proposal${savedCount === 1 ? "" : "s"}. ${formatNumber(issueCount)} row${issueCount === 1 ? "" : "s"} need attention.`
        });
      } else {
        setBulkMessage({
          tone: "error",
          text: "No proposals were saved. Fix row errors and try again."
        });
      }

      if (savedCount > 0) {
        await mutate();
        if (isOversight) {
          await mutatePending();
        }
      }
    } finally {
      setIsBulkSaving(false);
    }
  };

  const withExportRows = () => {
    if (exportRows.length > 0) {
      return true;
    }

    setExportMessage({
      tone: "error",
      text: "No rows are available to export for the current filters."
    });
    return false;
  };

  const exportCsv = () => {
    if (!withExportRows()) {
      setIsExportMenuOpen(false);
      return;
    }

    downloadFile(`${exportFilenameBase}.csv`, buildCsv(exportRows), "text/csv;charset=utf-8");
    setExportMessage({
      tone: "success",
      text: `CSV exported (${formatNumber(exportRows.length)} rows).`
    });
    setIsExportMenuOpen(false);
  };

  const exportExcel = () => {
    if (!withExportRows()) {
      setIsExportMenuOpen(false);
      return;
    }

    downloadFile(
      `${exportFilenameBase}.xls`,
      buildExcelHtml(exportRows, exportTitle, exportSubtitle),
      "application/vnd.ms-excel;charset=utf-8"
    );
    setExportMessage({
      tone: "success",
      text: `Excel file exported (${formatNumber(exportRows.length)} rows).`
    });
    setIsExportMenuOpen(false);
  };

  const exportPdf = () => {
    if (!withExportRows()) {
      setIsExportMenuOpen(false);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      setExportMessage({
        tone: "error",
        text: "The PDF export window was blocked. Allow pop-ups and try again."
      });
      setIsExportMenuOpen(false);
      return;
    }

    printWindow.document.write(buildPrintableHtml(exportRows, exportTitle, exportSubtitle));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);

    setExportMessage({
      tone: "success",
      text: "Print dialog opened. Choose Save as PDF to finish."
    });
    setIsExportMenuOpen(false);
  };

  const exportGoogleSheet = async () => {
    if (!withExportRows()) {
      setIsExportMenuOpen(false);
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(buildTsv(exportRows));

      window.open("https://docs.google.com/spreadsheets/create", "_blank", "noopener,noreferrer");

      setExportMessage({
        tone: "success",
        text: "Copied rows for Google Sheets. Paste into cell A1 in the new sheet."
      });
      setIsExportMenuOpen(false);
    } catch {
      downloadFile(`${exportFilenameBase}.csv`, buildCsv(exportRows), "text/csv;charset=utf-8");
      window.open("https://docs.google.com/spreadsheets/create", "_blank", "noopener,noreferrer");
      setExportMessage({
        tone: "error",
        text: "Clipboard access was blocked. Downloaded CSV instead; import that file in Google Sheets."
      });
      setIsExportMenuOpen(false);
    }
  };

  const updateDetailEditDraft = <K extends keyof ProposalDetailEditDraft>(
    key: K,
    value: ProposalDetailEditDraft[K]
  ) => {
    setDetailEditDraft((current) => (current ? { ...current, [key]: value } : current));
    setDetailEditError(null);
  };

  const saveDetailProposalEdits = async () => {
    if (!detailProposal || !detailEditDraft || !isOversight) {
      return;
    }

    const isVoteLocked =
      detailProposal.budgetYear === currentCalendarYear && detailProposal.progress.votesSubmitted > 0;
    const payload: Record<string, unknown> = {};

    if (!isVoteLocked) {
      const title = detailEditDraft.title.trim();
      if (!title) {
        setDetailEditError("Title is required.");
        return;
      }
      if (title !== detailProposal.title.trim()) {
        payload.title = title;
      }

      const description = detailEditDraft.description.trim();
      if (!description) {
        setDetailEditError("Description is required.");
        return;
      }
      if (description !== detailProposal.description.trim()) {
        payload.description = description;
      }

      const proposedAmount = parseNumberInput(detailEditDraft.proposedAmount);
      if (proposedAmount === null || proposedAmount < 0) {
        setDetailEditError("Proposed amount must be a non-negative number.");
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
      setDetailEditError("No changes to save.");
      return;
    }

    setIsDetailSaving(true);
    setDetailEditError(null);
    setRowMessage((current) => {
      const next = { ...current };
      delete next[detailProposal.id];
      return next;
    });

    try {
      const updatedProposal = await applyProposalPatch(detailProposal.id, payload);
      setDrafts((current) => ({
        ...current,
        [detailProposal.id]: toProposalDraft(updatedProposal)
      }));
      setDetailEditDraft(toProposalDetailEditDraft(updatedProposal));
      setIsDetailEditMode(false);
      setRowMessage((current) => ({
        ...current,
        [detailProposal.id]: {
          tone: "success",
          text: "Proposal details updated."
        }
      }));

      await mutate();
      if (isOversight) {
        await mutatePending();
      }
    } catch (saveError) {
      setDetailEditError(
        saveError instanceof Error ? saveError.message : "Failed to update proposal details."
      );
    } finally {
      setIsDetailSaving(false);
    }
  };

  const closeDetailDrawer = () => {
    setDetailProposalId(null);
  };

  const detailProposal = detailProposalId
    ? data.proposals.find((proposal) => proposal.id === detailProposalId) ?? null
    : null;
  const detailDraft = detailProposal ? drafts[detailProposal.id] ?? toProposalDraft(detailProposal) : null;
  const detailMasked = Boolean(detailProposal?.progress.masked && detailProposal.status === "to_review");
  const detailRequiredAction = detailProposal
    ? buildRequiredActionSummary(detailProposal, user?.role)
    : null;
  const detailRequiredActionToneClass = detailRequiredAction
    ? detailRequiredAction.tone === "attention"
      ? "text-amber-700 dark:text-amber-300"
      : detailRequiredAction.tone === "complete"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-zinc-700 dark:text-zinc-200"
    : "";
  const detailCanOversightEditProposal = Boolean(isOversight && detailProposal);
  const detailIsOwnProposal = Boolean(user && detailProposal && detailProposal.proposerId === user.id);
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
  const detailRowState = detailProposal ? rowMessage[detailProposal.id] : null;

  return (
    <div className="page-enter space-y-6 pb-4">
      <Card className="rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Annual Cycle</CardTitle>
            <CardValue className="text-xl font-bold">
              {isAllYearsView ? "All Years Master List Status" : `${selectedBudgetYear} Master List Status`}
            </CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <span className="status-dot bg-emerald-500" />
              {data.annualCycle.monthHint}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
              <span>Reset: {data.annualCycle.resetDate}</span>
              <span className="hidden text-zinc-300 dark:text-zinc-600 sm:inline">|</span>
              <span>Year-end deadline: {data.annualCycle.yearEndDeadline}</span>
            </div>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-end">
            <label className="text-xs font-semibold text-zinc-500">
              Budget year
              <select
                className="field-control field-control--compact mt-1 block rounded-lg"
                value={selectedYearFilterValue}
                onChange={(event) =>
                  setSelectedYear(event.target.value === "all" ? "all" : Number(event.target.value))
                }
              >
                <option value="all">All years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href="/proposals/new"
              className="new-proposal-cta sm:min-h-11 sm:px-4 sm:text-sm"
            >
              <Plus className="h-4 w-4" /> New Proposal
            </Link>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:auto-rows-fr">
          <MetricCard
            title="TOTAL BUDGET"
            value={currency(data.budget.total)}
            icon={DollarSign}
            tone="emerald"
          />
          <MetricCard
            title="TOTAL ALLOCATED"
            value={currency(totalAllocatedForYear)}
            icon={PieChart}
            tone="sky"
          />
          <MetricCard
            title="JOINT POOL REMAINING"
            value={currency(data.budget.jointRemaining)}
            subtitle={`Allocated: ${currency(data.budget.jointAllocated)}`}
            icon={Users}
            tone="indigo"
          >
            <div className="budget-progress-track mt-2">
              <div
                className={`budget-progress-fill ${jointUtilization > 100 ? "bg-rose-500" : "bg-indigo-500 dark:bg-indigo-400"}`}
                style={{ width: `${Math.min(jointUtilization, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{Math.round(jointUtilization)}% utilized</p>
          </MetricCard>
          <MetricCard
            title="DISCRETIONARY REMAINING"
            value={currency(data.budget.discretionaryRemaining)}
            subtitle={`Allocated: ${currency(data.budget.discretionaryAllocated)}`}
            icon={Wallet}
            tone="amber"
          >
            <div className="budget-progress-track mt-2">
              <div
                className={`budget-progress-fill ${discretionaryUtilization > 100 ? "bg-rose-500" : "bg-amber-500 dark:bg-amber-400"}`}
                style={{ width: `${Math.min(discretionaryUtilization, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{Math.round(discretionaryUtilization)}% utilized</p>
          </MetricCard>
        </div>
        <Card>
          <CardTitle>Historical Impact</CardTitle>
          <HistoricalImpactChart data={data.historyByYear} />
        </Card>
      </section>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{showPendingTab ? "Pending" : "Grant Tracker"}</CardTitle>
            <p className="text-xs text-zinc-500">
              {showPendingTab
                ? "All budget years. Includes proposals not yet Sent or Declined."
                : "Statuses: To Review, Approved, Sent, Declined"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOversight ? (
              <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setActiveTab("tracker")}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
                    activeTab === "tracker"
                      ? "bg-accent text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  Grant Tracker
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pending")}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
                    activeTab === "pending"
                      ? "bg-accent text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  Pending
                </button>
              </div>
            ) : null}
            {!showPendingTab ? (
              <>
                {canEditHistorical && !allowHistoricalBulkEdit ? (
                  <p className="text-xs text-zinc-500">
                    Historical year {selectedBudgetYear}. Bulk edit is unavailable for Oversight profiles.
                  </p>
                ) : null}
                {allowHistoricalBulkEdit && canEditHistorical && !isHistoricalBulkEditEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkEditMode(true);
                      setBulkMessage(null);
                      setRowMessage({});
                    }}
                    className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white"
                  >
                    Bulk Edit
                  </button>
                ) : null}
                {allowHistoricalBulkEdit && canEditHistorical && isHistoricalBulkEditEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void saveHistoricalBulk()}
                      disabled={isBulkSaving || dirtyHistoricalCount === 0}
                      className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {isBulkSaving
                        ? "Saving..."
                        : `Bulk Save${dirtyHistoricalCount > 0 ? ` (${formatNumber(dirtyHistoricalCount)})` : ""}`}
                    </button>
                    <button
                      type="button"
                      onClick={cancelBulkEdit}
                      disabled={isBulkSaving}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        {!showPendingTab && bulkMessage ? (
          <p
            className={`mb-3 text-xs ${
              bulkMessage.tone === "error"
                ? "text-rose-600"
                : "text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {bulkMessage.text}
          </p>
        ) : null}

        {showPendingTab ? (
          <div className="overflow-x-auto">
            {pendingError ? (
              <p className="rounded-xl border p-4 text-sm text-rose-600">
                Failed to load pending proposals: {pendingError.message}
              </p>
            ) : isPendingLoading && !pendingData ? (
              <p className="rounded-xl border p-4 text-sm text-zinc-500">Loading pending proposals...</p>
            ) : pendingProposals.length === 0 ? (
              <p className="rounded-xl border p-4 text-sm text-zinc-500">
                No pending proposals across all budget years.
              </p>
            ) : (
              <table className="min-w-[860px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-2 py-2">Proposal</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Required Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProposals.map((proposal) => {
                    const masked = proposal.progress.masked && proposal.status === "to_review";

                    return (
                      <tr key={proposal.id} className="border-b align-top">
                        <td className="px-2 py-3">
                          <p className="font-semibold">{proposal.title}</p>
                          <p className="mt-1 text-xs text-zinc-500">Budget year {proposal.budgetYear}</p>
                        </td>
                        <td className="px-2 py-3 text-xs text-zinc-500">
                          {titleCase(proposal.proposalType)}
                        </td>
                        <td className="px-2 py-3 text-xs text-zinc-500">
                          {masked
                            ? "Blind until your vote is submitted"
                            : currency(proposal.progress.computedFinalAmount)}
                        </td>
                        <td className="px-2 py-3">
                          <StatusPill status={proposal.status} />
                        </td>
                        <td className="px-2 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                          {buildPendingActionRequiredLabel(proposal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-xs text-zinc-500">
                Showing {formatNumber(filteredAndSortedProposals.length)} proposals for {selectedBudgetYearLabel}
              </p>
              <div className="relative shrink-0" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen((current) => !current);
                    setExportMessage(null);
                  }}
                  className="inline-flex min-h-10 items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-haspopup="menu"
                  aria-expanded={isExportMenuOpen}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExportMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {isExportMenuOpen ? (
                  <div className="absolute right-0 top-11 z-30 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={exportPdf}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Export as PDF
                    </button>
                    <button
                      type="button"
                      onClick={exportCsv}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Export as CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportExcel}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Export as Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void exportGoogleSheet();
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Export to Google Sheet
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <FilterPanel className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
              <label className="text-xs font-semibold text-zinc-500">
                Search
                <input
                  type="text"
                  value={filters.proposal}
                  onChange={(event) => setFilter("proposal", event.target.value)}
                  placeholder="Title or description"
                  className="field-control mt-1 w-full normal-case"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Type
                <select
                  value={filters.proposalType}
                  onChange={(event) =>
                    setFilter("proposalType", event.target.value as TableFilters["proposalType"])
                  }
                  className="field-control mt-1 w-full normal-case"
                >
                  <option value="all">All</option>
                  <option value="joint">Joint</option>
                  <option value="discretionary">Discretionary</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Status
                <select
                  value={filters.status}
                  onChange={(event) => setFilter("status", event.target.value as TableFilters["status"])}
                  className="field-control mt-1 w-full normal-case"
                >
                  <option value="all">All</option>
                  {STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {titleCase(statusOption)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearTrackerFilters}
                  className="min-h-10 w-full rounded-md border border-zinc-300 px-2 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:w-auto"
                >
                  Clear filters
                </button>
              </div>
            </FilterPanel>

            {exportMessage ? (
              <p
                className={`mb-3 text-xs ${
                  exportMessage.tone === "error"
                    ? "text-rose-600"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {exportMessage.text}
              </p>
            ) : null}

        <div className="space-y-3 md:hidden" onClick={() => setIsExportMenuOpen(false)}>
          {filteredAndSortedProposals.length === 0 ? (
            <p className="rounded-xl border p-4 text-sm text-zinc-500">
              No proposals match the current filters for {selectedBudgetYearLabel}.
            </p>
          ) : (
            filteredAndSortedProposals.map((proposal) => {
              const draft = drafts[proposal.id] ?? toProposalDraft(proposal);
              const masked = proposal.progress.masked && proposal.status === "to_review";
              const requiredAction = buildRequiredActionSummary(proposal, user?.role);
              const isOwnProposal = Boolean(user && proposal.proposerId === user.id);
              const isRowEditable = isHistoricalBulkEditEnabled;
              const canEditSentDate =
                isRowEditable || (!canEditHistorical && isOwnProposal && proposal.status === "sent");
              const sentDateDisabled = isRowEditable ? draft.status !== "sent" : !canEditSentDate;
              const rowState = rowMessage[proposal.id];
              const parsedDraftFinalAmount = parseNumberInput(draft.finalAmount);
              const requiredActionToneClass =
                requiredAction.tone === "attention"
                  ? "text-amber-700 dark:text-amber-300"
                  : requiredAction.tone === "complete"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-zinc-700 dark:text-zinc-200";

              return (
                <article key={proposal.id} className={`rounded-xl border border-t-2 p-4 ${
                  proposal.proposalType === "joint"
                    ? "border-t-indigo-400 dark:border-t-indigo-500"
                    : "border-t-amber-400 dark:border-t-amber-500"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{proposal.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{proposal.description}</p>
                    </div>
                    <StatusPill status={proposal.status} />
                  </div>

                  {!isRowEditable ? (
                    <p className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                      {masked
                        ? "Blind until your vote is submitted"
                        : currency(proposal.progress.computedFinalAmount)}
                    </p>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500">Type</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">{titleCase(proposal.proposalType)}</p>
                    </div>
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500">Sent</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">{proposal.sentAt ?? "—"}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-zinc-200/70 bg-zinc-50/50 p-2 dark:border-zinc-700/50 dark:bg-zinc-800/30">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Required Action
                    </p>
                    <p className={`mt-1 text-xs ${requiredActionToneClass}`}>
                      <span className="font-semibold">{requiredAction.owner}:</span>{" "}
                      {requiredAction.detail}
                    </p>
                    {requiredAction.href && requiredAction.ctaLabel ? (
                      <Link
                        href={requiredAction.href}
                        className="mt-2 inline-flex rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {requiredAction.ctaLabel}
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">Amount</p>
                      {isRowEditable ? (
                        <>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={draft.finalAmount}
                            onChange={(event) => updateDraft(proposal.id, { finalAmount: event.target.value })}
                            className="field-control mt-1 w-full"
                          />
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Amount preview: {parsedDraftFinalAmount !== null ? currency(parsedDraftFinalAmount) : "—"}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-700 dark:text-zinc-200">
                          {masked
                            ? "Blind until your vote is submitted"
                            : currency(proposal.progress.computedFinalAmount)}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-zinc-500">Status</p>
                      {isRowEditable ? (
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft(proposal.id, {
                              status: event.target.value as ProposalStatus,
                              ...(event.target.value === "sent" ? {} : { sentAt: "" })
                            })
                          }
                          className="field-control mt-1 w-full"
                        >
                          {STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {titleCase(statusOption)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-zinc-700 dark:text-zinc-200">
                          {titleCase(proposal.status)}
                        </p>
                      )}
                    </div>

                    {canEditSentDate ? (
                      <label className="block text-xs font-semibold text-zinc-500">
                        Date amount sent
                        <input
                          type="date"
                          value={draft.sentAt}
                          disabled={sentDateDisabled}
                          onChange={(event) => updateDraft(proposal.id, { sentAt: event.target.value })}
                          className="field-control mt-1 w-full disabled:opacity-50"
                        />
                      </label>
                    ) : (
                      <p className="text-xs text-zinc-500">Date amount sent: {proposal.sentAt ?? "—"}</p>
                    )}

                    {isRowEditable ? (
                      <label className="block text-xs font-semibold text-zinc-500">
                        Notes
                        <input
                          type="text"
                          value={draft.notes}
                          onChange={(event) => updateDraft(proposal.id, { notes: event.target.value })}
                          placeholder="Optional notes"
                          className="field-control mt-1 w-full"
                        />
                      </label>
                    ) : proposal.notes?.trim() ? (
                      <p className="text-xs text-zinc-500">Notes: {proposal.notes}</p>
                    ) : null}

                    {!canEditHistorical && isOwnProposal && proposal.status === "sent" ? (
                      <button
                        type="button"
                        disabled={savingProposalId === proposal.id}
                        onClick={() => void saveProposalSentDate(proposal)}
                        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {savingProposalId === proposal.id ? "Saving..." : "Save date"}
                      </button>
                    ) : null}

                    {user &&
                    canVote &&
                    proposal.status === "to_review" &&
                    !proposal.progress.hasCurrentUserVoted ? (
                      <VoteForm
                        proposalId={proposal.id}
                        proposalType={proposal.proposalType}
                        proposedAmount={proposal.proposedAmount}
                        totalRequiredVotes={proposal.progress.totalRequiredVotes}
                        onSuccess={() => {
                          void mutate();
                          if (isOversight) {
                            void mutatePending();
                          }
                        }}
                      />
                    ) : null}

                    {rowState ? (
                      <p
                        className={`text-xs ${
                          rowState.tone === "error"
                            ? "text-rose-600"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {rowState.text}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setDetailProposalId(proposal.id)}
                      className="mt-3 w-full rounded-lg border border-zinc-200 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      View Details
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="hidden overflow-x-auto md:block" onClick={() => setIsExportMenuOpen(false)}>
          <table className="w-full min-w-[980px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[20rem]" />
              <col className="w-[6.5rem]" />
              <col className="w-[8rem]" />
              <col className="w-[8rem]" />
              <col className="w-[7.5rem]" />
              <col />
              <col className="w-[4.5rem]" />
            </colgroup>
            <thead>
              <DataTableHeadRow>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("proposal")}>
                    Proposal{sortMarker("proposal")}
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("type")}>
                    Type{sortMarker("type")}
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("amount")}>
                    Amount{sortMarker("amount")}
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("sentAt")}>
                    Date Sent{sortMarker("sentAt")}
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("status")}>
                    Status{sortMarker("status")}
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">Required Action</th>
                <th className="px-2 py-3 text-right">Details</th>
              </DataTableHeadRow>
            </thead>
            <tbody>
              {filteredAndSortedProposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-zinc-500">
                    No proposals match the current filters for {selectedBudgetYearLabel}.
                  </td>
                </tr>
              ) : (
                filteredAndSortedProposals.map((proposal) => {
                  const draft = drafts[proposal.id] ?? toProposalDraft(proposal);
                  const masked = proposal.progress.masked && proposal.status === "to_review";
                  const rowState = rowMessage[proposal.id];
                  const parsedDraftFinalAmount = parseNumberInput(draft.finalAmount);
                  const requiredAction = buildRequiredActionSummary(proposal, user?.role);
                  const requiredActionToneClass =
                    requiredAction.tone === "attention"
                      ? "text-amber-700 dark:text-amber-300"
                      : requiredAction.tone === "complete"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-zinc-700 dark:text-zinc-200";
                  const showRequiredActionButton =
                    requiredAction.tone === "attention" &&
                    Boolean(requiredAction.href && requiredAction.ctaLabel);
                  const amountDisplay =
                    masked
                      ? "Blind until your vote is submitted"
                      : isHistoricalBulkEditEnabled
                      ? parsedDraftFinalAmount !== null && parsedDraftFinalAmount >= 0
                        ? currency(parsedDraftFinalAmount)
                        : "Invalid amount"
                      : currency(proposal.progress.computedFinalAmount);
                  const amountToneClass =
                    isHistoricalBulkEditEnabled &&
                    !masked &&
                    (parsedDraftFinalAmount === null || parsedDraftFinalAmount < 0)
                      ? "text-rose-600"
                      : "text-zinc-600 dark:text-zinc-300";
                  const statusDisplay = isHistoricalBulkEditEnabled ? draft.status : proposal.status;
                  const sentAtDisplay = isHistoricalBulkEditEnabled ? draft.sentAt || "—" : proposal.sentAt ?? "—";

                  return (
                    <DataTableRow key={proposal.id}>
                      <td className="w-[20rem] max-w-[20rem] px-2 py-3">
                        <p className="block max-w-full truncate font-semibold" title={proposal.title}>
                          {proposal.title}
                        </p>
                        <p
                          className="mt-1 block max-w-full truncate text-xs text-zinc-500"
                          title={proposal.description}
                        >
                          {proposal.description}
                        </p>
                      </td>
                      <td className="px-2 py-3 text-xs text-zinc-500">{titleCase(proposal.proposalType)}</td>
                      <td className="px-2 py-3 text-xs">
                        <p className={amountToneClass}>{amountDisplay}</p>
                      </td>
                      <td className="px-2 py-3 text-xs text-zinc-500">{sentAtDisplay}</td>
                      <td className="px-2 py-3">
                        <StatusPill status={statusDisplay} />
                      </td>
                      <td className="px-2 py-3">
                        <p className={`text-xs ${requiredActionToneClass}`}>
                          <span className="font-semibold">{requiredAction.owner}:</span> {requiredAction.detail}
                        </p>
                        {showRequiredActionButton ? (
                          <Link
                            href={requiredAction.href!}
                            className="mt-2 inline-flex rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            {requiredAction.ctaLabel}
                          </Link>
                        ) : null}
                        {rowState ? (
                          <p
                            className={`mt-2 text-xs ${
                              rowState.tone === "error"
                                ? "text-rose-600"
                                : "text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {rowState.text}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailProposalId(proposal.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          aria-label={`View details for ${proposal.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </DataTableRow>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

          </>
        )}
      </Card>

      {detailProposal && detailDraft && detailRequiredAction ? (
        <ModalOverlay
          onClose={closeDetailDrawer}
          placement="center"
        >
          <ModalPanel aria-labelledby="proposal-details-title" className="max-w-3xl rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="proposal-details-title" className="text-lg font-bold">
                    Proposal Details
                  </h2>
                  <Badge className={detailProposal.proposalType === "joint"
                    ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
                    : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
                  }>
                    {titleCase(detailProposal.proposalType)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{detailProposal.title}</p>
              </div>
              <button
                type="button"
                onClick={closeDetailDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Close proposal details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-4 grid gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/40 md:grid-cols-2">
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Proposal</dt>
                <dd className="mt-1.5 font-semibold text-zinc-800 dark:text-zinc-100">{detailProposal.title}</dd>
                <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-500">
                  {detailProposal.description || "—"}
                </p>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Type</dt>
                <dd className="mt-1.5 font-semibold text-zinc-800 dark:text-zinc-100">{titleCase(detailProposal.proposalType)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Amount</dt>
                <dd className="mt-1.5 text-lg font-bold text-zinc-800 dark:text-zinc-100">
                  {detailMasked
                    ? "Blind until your vote is submitted"
                    : currency(detailProposal.progress.computedFinalAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Date Sent</dt>
                <dd className="mt-1.5 font-semibold text-zinc-800 dark:text-zinc-100">{detailProposal.sentAt ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Status</dt>
                <dd className="mt-1.5 font-semibold text-zinc-800 dark:text-zinc-100">{titleCase(detailProposal.status)}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Required Action</dt>
                <dd className={`mt-1.5 ${detailRequiredActionToneClass}`}>
                  <span className="font-semibold">{detailRequiredAction.owner}:</span>{" "}
                  {detailRequiredAction.detail}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Organization Website</dt>
                <dd className="mt-1.5 text-zinc-800 dark:text-zinc-100">
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
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Charity Navigator URL</dt>
                <dd className="mt-1.5 text-zinc-800 dark:text-zinc-100">
                  {detailProposal.charityNavigatorUrl ? (
                    <a
                      href={detailProposal.charityNavigatorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                    >
                      {detailProposal.charityNavigatorUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Notes</dt>
                <dd className="mt-1.5 whitespace-pre-wrap font-semibold text-zinc-800 dark:text-zinc-100">{detailProposal.notes?.trim() || "—"}</dd>
              </div>
            </dl>

            {detailIsRowEditable || detailCanEditSentDate ? (
              <>
              <div className="mt-5 flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Edit</span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {detailIsRowEditable ? (
                  <label className="text-xs font-semibold text-zinc-500">
                    Amount
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={detailDraft.finalAmount}
                      onChange={(event) =>
                        updateDraft(detailProposal.id, { finalAmount: event.target.value })
                      }
                      className="field-control mt-1 w-full"
                    />
                    <span className="mt-1 block text-[11px] text-zinc-500">
                      Amount preview:{" "}
                      {detailParsedDraftFinalAmount !== null && detailParsedDraftFinalAmount >= 0
                        ? currency(detailParsedDraftFinalAmount)
                        : "Invalid amount"}
                    </span>
                  </label>
                ) : null}

                {detailIsRowEditable ? (
                  <label className="text-xs font-semibold text-zinc-500">
                    Status
                    <select
                      value={detailDraft.status}
                      onChange={(event) =>
                        updateDraft(detailProposal.id, {
                          status: event.target.value as ProposalStatus,
                          ...(event.target.value === "sent" ? {} : { sentAt: "" })
                        })
                      }
                      className="field-control mt-1 w-full"
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
                  <label className="text-xs font-semibold text-zinc-500">
                    Date amount sent
                    <input
                      type="date"
                      value={detailDraft.sentAt}
                      disabled={detailSentDateDisabled}
                      onChange={(event) => updateDraft(detailProposal.id, { sentAt: event.target.value })}
                      className="field-control mt-1 w-full disabled:opacity-50"
                    />
                  </label>
                ) : null}

                {detailIsRowEditable ? (
                  <label className="text-xs font-semibold text-zinc-500 md:col-span-2">
                    Notes
                    <input
                      type="text"
                      value={detailDraft.notes}
                      onChange={(event) => updateDraft(detailProposal.id, { notes: event.target.value })}
                      placeholder="Optional notes"
                      className="field-control mt-1 w-full"
                    />
                  </label>
                ) : null}
              </div>
              </>
            ) : null}

            {detailCanOversightEditProposal && isDetailEditMode && detailEditDraft ? (
              <>
                <div className="mt-5 flex items-center gap-2">
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                    Proposal Content & Links
                  </span>
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                </div>
                {detailIsVoteLocked ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Votes have already been submitted for this active-year proposal. Only URL fields can be updated.
                  </p>
                ) : null}
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold text-zinc-500">
                    Proposal title
                    <input
                      type="text"
                      value={detailEditDraft.title}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("title", event.target.value)}
                      className="field-control mt-1 w-full disabled:opacity-50"
                    />
                  </label>
                  <label className="text-xs font-semibold text-zinc-500">
                    Proposed amount
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={detailEditDraft.proposedAmount}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("proposedAmount", event.target.value)}
                      className="field-control mt-1 w-full disabled:opacity-50"
                    />
                    <span className="mt-1 block text-[11px] text-zinc-500">
                      Amount preview:{" "}
                      {detailParsedDraftProposedAmount !== null && detailParsedDraftProposedAmount >= 0
                        ? currency(detailParsedDraftProposedAmount)
                        : "Invalid amount"}
                    </span>
                  </label>
                  <label className="text-xs font-semibold text-zinc-500 md:col-span-2">
                    Description
                    <textarea
                      value={detailEditDraft.description}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("description", event.target.value)}
                      className="field-control mt-1 min-h-20 w-full disabled:opacity-50"
                    />
                  </label>
                  <label className="text-xs font-semibold text-zinc-500 md:col-span-2">
                    Notes
                    <input
                      type="text"
                      value={detailEditDraft.notes}
                      disabled={!detailCanEditNonUrlFields || isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("notes", event.target.value)}
                      placeholder="Optional notes"
                      className="field-control mt-1 w-full disabled:opacity-50"
                    />
                  </label>
                  <label className="text-xs font-semibold text-zinc-500 md:col-span-2">
                    Organization website URL
                    <input
                      type="url"
                      value={detailEditDraft.website}
                      disabled={isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("website", event.target.value)}
                      className="field-control mt-1 w-full disabled:opacity-50"
                      placeholder="https://example.org"
                    />
                  </label>
                  <label className="text-xs font-semibold text-zinc-500 md:col-span-2">
                    Charity Navigator URL
                    <input
                      type="url"
                      value={detailEditDraft.charityNavigatorUrl}
                      disabled={isDetailSaving}
                      onChange={(event) => updateDetailEditDraft("charityNavigatorUrl", event.target.value)}
                      className="field-control mt-1 w-full disabled:opacity-50"
                      placeholder="https://www.charitynavigator.org/..."
                    />
                  </label>
                </div>
                {detailEditError ? (
                  <p className="mt-3 text-xs text-rose-600">{detailEditError}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailEditDraft(toProposalDetailEditDraft(detailProposal));
                      setIsDetailEditMode(false);
                      setDetailEditError(null);
                    }}
                    disabled={isDetailSaving}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveDetailProposalEdits()}
                    disabled={isDetailSaving}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {isDetailSaving ? "Saving..." : "Save proposal changes"}
                  </button>
                </div>
              </>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {detailRequiredAction.href && detailRequiredAction.ctaLabel ? (
                <Link
                  href={detailRequiredAction.href}
                  className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {detailRequiredAction.ctaLabel}
                </Link>
              ) : null}
              {detailCanOversightEditProposal ? (
                <button
                  type="button"
                  disabled={isDetailSaving}
                  onClick={() => {
                    if (isDetailEditMode) {
                      setIsDetailEditMode(false);
                      setDetailEditError(null);
                      return;
                    }
                    setDetailEditDraft(toProposalDetailEditDraft(detailProposal));
                    setDetailEditError(null);
                    setIsDetailEditMode(true);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {isDetailEditMode ? "Close edit" : "Edit proposal"}
                </button>
              ) : null}
              {!canEditHistorical && detailIsOwnProposal && detailProposal.status === "sent" ? (
                <button
                  type="button"
                  disabled={savingProposalId === detailProposal.id}
                  onClick={() => void saveProposalSentDate(detailProposal)}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {savingProposalId === detailProposal.id ? "Saving..." : "Save date"}
                </button>
              ) : null}
            </div>

            {user &&
            canVote &&
            detailProposal.status === "to_review" &&
            !detailProposal.progress.hasCurrentUserVoted ? (
              <div className="mt-4">
                <VoteForm
                  proposalId={detailProposal.id}
                  proposalType={detailProposal.proposalType}
                  proposedAmount={detailProposal.proposedAmount}
                  totalRequiredVotes={detailProposal.progress.totalRequiredVotes}
                  onSuccess={() => {
                    void mutate();
                    if (isOversight) {
                      void mutatePending();
                    }
                  }}
                />
              </div>
            ) : null}

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
          </ModalPanel>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
