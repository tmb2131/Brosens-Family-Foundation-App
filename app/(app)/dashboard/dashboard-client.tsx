"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useSWR, { mutate as globalMutate } from "swr";
import { mutateAllFoundation } from "@/lib/swr-helpers";
import { ChevronDown, ChevronUp, CheckCircle2, DollarSign, Download, MoreHorizontal, Plus, RefreshCw, Users, Wallet, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { DataTableHeadRow, DataTableRow, DataTableSortButton } from "@/components/ui/data-table";
import { FilterPanel } from "@/components/ui/filter-panel";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { charityNavigatorRating, currency, formatNumber, parseNumberInput, titleCase, toISODate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";

const HistoricalImpactChart = dynamic(
  () => import("@/components/dashboard/historical-impact-chart").then((mod) => mod.HistoricalImpactChart),
  { ssr: false, loading: () => <div className="flex h-[220px] w-full items-end gap-2 px-4 pb-4"><div className="h-[40%] flex-1 animate-pulse rounded-t-md bg-muted" /><div className="h-[65%] flex-1 animate-pulse rounded-t-md bg-muted" /><div className="h-[80%] flex-1 animate-pulse rounded-t-md bg-muted" /><div className="h-[55%] flex-1 animate-pulse rounded-t-md bg-muted" /></div> }
);
import { AppRole, FoundationHistorySnapshot, FoundationSnapshot, ProposalStatus, WorkspaceSnapshot } from "@/lib/types";
import { VoteForm } from "@/components/voting/vote-form";
import { useDashboardWalkthrough } from "@/components/dashboard-walkthrough-context";

const DASHBOARD_WALKTHROUGH_STEPS: Array<{
  target: string;
  targetFallback?: string;
  title: string;
  body: string;
}> = [
  {
    target: "dashboard-intro",
    targetFallback: "dashboard-intro-mobile",
    title: "Dashboard",
    body:
      "Foundation-wide view. Pick a budget year and use New Proposal to start a grant."
  },
  {
    target: "dashboard-budget",
    targetFallback: "dashboard-budget-mobile",
    title: "Foundation budget",
    body:
      "View the Foundation's total budget, Joint pool remaining, and Discretionary remaining for the selected year. Progress bars show how much has been allocated."
  },
  {
    target: "dashboard-history",
    title: "Historical Impact",
    body: "See how grant spending has changed over budget years."
  },
  {
    target: "dashboard-tracker",
    title: "Grant Tracker",
    body:
      "Grant Tracker lists all proposals for the selected year with status. Use filters and sort to find items."
  }
];

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
  /** When true, CTA should open the proposal detail modal (e.g. to submit vote) instead of navigating. */
  openDetail?: boolean;
}

type SortKey = "proposal" | "type" | "amount" | "status" | "sentAt" | "notes" | "createdAt";
type SortDirection = "asc" | "desc";

interface TableFilters {
  proposal: string;
  proposalType: "all" | "joint" | "discretionary";
  status: "all" | ProposalStatus;
  myActions: boolean;
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
  status: "all",
  myActions: false
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
          ? `${formatNumber(remainingVotes)} voting ${memberLabel} still need to submit their allocations.`
          : `${formatNumber(remainingVotes)} voting ${memberLabel} still need to submit acknowledgement/flag votes.`;
      const viewerCanVote = viewerRole === "member" || viewerRole === "oversight";
      const viewerNeedsToVote = viewerCanVote && !proposal.progress.hasCurrentUserVoted;

      if (viewerNeedsToVote) {
        return {
          owner: "You",
          detail: `Submit your vote. ${voteDetail}`,
          tone: "attention",
          ctaLabel: "Submit your vote",
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

export default function DashboardClient() {
  const { user } = useAuth();
  const isOversight = user?.role === "oversight";
  const [selectedYear, setSelectedYear] = useState<SelectedYear>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("pending");
  const [drafts, setDrafts] = useState<Record<string, ProposalDraft>>({});
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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

  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const { registerStartWalkthrough } = useDashboardWalkthrough();

  useEffect(() => {
    return registerStartWalkthrough(() => {
      setWalkthroughStep(0);
      setWalkthroughOpen(true);
    });
  }, [registerStartWalkthrough]);

  const closeWalkthrough = useCallback(() => {
    setWalkthroughOpen(false);
    setWalkthroughStep(0);
    setSpotlightRect(null);
  }, []);

  function getTargetElementForStep(stepIndex: number): HTMLElement | null {
    const step = DASHBOARD_WALKTHROUGH_STEPS[stepIndex];
    if (!step) return null;
    const primary = document.querySelector<HTMLElement>(`[data-walkthrough="${step.target}"]`);
    const fallback = step.targetFallback
      ? document.querySelector<HTMLElement>(`[data-walkthrough="${step.targetFallback}"]`)
      : null;
    const hasSize = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    if (primary && hasSize(primary)) return primary;
    if (fallback && hasSize(fallback)) return fallback;
    return primary ?? fallback ?? null;
  }

  const measureAndSetRect = useCallback((stepIndex: number) => {
    const el = getTargetElementForStep(stepIndex);
    if (el) {
      const r = el.getBoundingClientRect();
      setSpotlightRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    } else {
      setSpotlightRect(null);
    }
  }, []);

  useLayoutEffect(() => {
    if (!walkthroughOpen) return;
    const el = getTargetElementForStep(walkthroughStep);
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
    measureAndSetRect(walkthroughStep);
    const t1 = setTimeout(() => measureAndSetRect(walkthroughStep), 50);
    const t2 = setTimeout(() => measureAndSetRect(walkthroughStep), 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [walkthroughOpen, walkthroughStep, measureAndSetRect]);

  useEffect(() => {
    if (!walkthroughOpen) return;
    const handleResize = () => measureAndSetRect(walkthroughStep);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [walkthroughOpen, walkthroughStep, measureAndSetRect]);

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

  const { data, isLoading, error, mutate } = useSWR<FoundationSnapshot>(foundationKey, {
    refreshInterval: 30_000
  });
  const {
    data: historyData,
    error: historyError,
    isLoading: isHistoryLoading
  } = useSWR<FoundationHistorySnapshot>(user ? "/api/foundation/history" : null);
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    error: pendingError,
    mutate: mutatePending
  } = useSWR<PendingResponse>(isOversight ? "/api/foundation/pending" : null, {
    refreshInterval: 30_000
  });
  const workspaceQuery = useSWR<WorkspaceSnapshot>(user ? "/api/workspace" : null, {
    refreshInterval: 30_000
  });
  const workspace = workspaceQuery.data;

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

    if (selectedYear === null || selectedYear === "all") {
      return;
    }

    if (!availableYears.includes(selectedYear)) {
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

      if (filters.myActions) {
        const requiredAction = buildRequiredActionSummary(proposal, user?.role);
        const viewerMustAct =
          requiredAction.tone === "attention" &&
          (requiredAction.openDetail ||
            (requiredAction.href === "/meeting" && (user?.role === "oversight" || user?.role === "manager")) ||
            (requiredAction.href === "/admin" && user?.role === "admin"));
        if (!viewerMustAct) {
          return false;
        }
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
      } else if (sortKey === "createdAt") {
        comparison = a.createdAt.localeCompare(b.createdAt);
      }

      if (comparison === 0) {
        comparison = a.title.localeCompare(b.title);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [data, filters, sortDirection, sortKey, user?.role]);

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
  const totalUtilization = data && data.budget.total > 0
    ? (totalAllocatedForYear / data.budget.total) * 100
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
    return (
      <div className="page-stack pb-4">
        <SkeletonCard />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonChart />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !data) {
    return (
      <GlassCard>
        <CardLabel>Dashboard Error</CardLabel>
        <p className="mt-2 text-sm text-rose-600">
          Failed to load dashboard{error ? `: ${error.message}` : "."}
        </p>
        <Button variant="outline" size="lg" className="mt-3" onClick={() => void mutate()}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </GlassCard>
    );
  }

  const setFilter = <K extends keyof TableFilters>(key: K, value: TableFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setExportMessage(null);
    setIsExportMenuOpen(false);
  };
  const exportRows: ProposalExportRow[] = filteredAndSortedProposals.map((proposal) => {
    const masked = proposal.progress.masked && proposal.status === "to_review" && proposal.proposalType !== "discretionary";
    const requiredAction = buildRequiredActionSummary(proposal, user?.role);
    const requiredActionLabel =
      requiredAction.owner === "None"
        ? requiredAction.detail
        : `${requiredAction.owner}: ${requiredAction.detail}`;
    return {
      proposal: proposal.title.trim(),
      description: proposal.description.trim(),
      type: titleCase(proposal.proposalType),
      amount: masked && proposal.proposalType !== "joint" ? "Blind until your vote is submitted" : proposal.proposalType === "joint" && proposal.status === "to_review" ? currency(proposal.proposedAmount) : proposal.progress.computedFinalAmount.toFixed(2),
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

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortDirection === "asc"
      ? <ChevronUp className="inline h-3 w-3 ml-0.5" />
      : <ChevronDown className="inline h-3 w-3 ml-0.5" />;
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

      mutateAllFoundation();
      void globalMutate("/api/navigation/summary");
      void globalMutate("/api/workspace");
      if (isOversight) {
        void mutatePending();
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
        mutateAllFoundation();
        void globalMutate("/api/navigation/summary");
        void globalMutate("/api/workspace");
        if (isOversight) {
          void mutatePending();
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

      mutateAllFoundation();
      void globalMutate("/api/navigation/summary");
      void globalMutate("/api/workspace");
      if (isOversight) {
        void mutatePending();
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
  const detailMasked = Boolean(detailProposal?.progress.masked && detailProposal.status === "to_review" && detailProposal.proposalType !== "discretionary");
  const detailRequiredAction = detailProposal
    ? buildRequiredActionSummary(detailProposal, user?.role)
    : null;
  const detailRequiredActionToneClass = detailRequiredAction
    ? detailRequiredAction.tone === "attention"
      ? "text-amber-700 dark:text-amber-300"
      : detailRequiredAction.tone === "complete"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-foreground"
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
    <div className="page-stack pb-4">
      {walkthroughOpen &&
        spotlightRect &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[45] pointer-events-none" aria-hidden>
              <div
                className="bg-transparent"
                style={{
                  position: "fixed",
                  left: spotlightRect.left,
                  top: spotlightRect.top,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                  boxShadow: "0 0 0 9999px hsl(0 0% 0% / 0.45)",
                  outline: "2px solid hsl(var(--accent))",
                  outlineOffset: 4,
                  borderRadius: "0.75rem"
                }}
              />
            </div>
            <div className="fixed inset-0 z-[45] pointer-events-auto" aria-hidden>
              <div
                className="pointer-events-none"
                style={{
                  position: "fixed",
                  left: spotlightRect.left,
                  top: spotlightRect.top,
                  width: spotlightRect.width,
                  height: spotlightRect.height
                }}
              />
            </div>
          </>,
          document.body
        )}

      <Dialog
        open={walkthroughOpen}
        onOpenChange={(open) => {
          if (!open) closeWalkthrough();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {(() => {
            const step = DASHBOARD_WALKTHROUGH_STEPS[walkthroughStep];
            if (!step) return null;
            const isFirst = walkthroughStep === 0;
            const isLast = walkthroughStep === DASHBOARD_WALKTHROUGH_STEPS.length - 1;
            return (
              <>
                <DialogHeader>
                  <p className="text-xs font-medium text-muted-foreground" aria-hidden>
                    Step {walkthroughStep + 1} of {DASHBOARD_WALKTHROUGH_STEPS.length}
                  </p>
                  <DialogTitle id="dashboard-walkthrough-title">{step.title}</DialogTitle>
                  <DialogDescription id="dashboard-walkthrough-description" className="mt-1 text-left">
                    {step.body}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 flex-row flex-wrap gap-2 sm:justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="order-last sm:order-first text-muted-foreground"
                    onClick={closeWalkthrough}
                  >
                    Skip tour
                  </Button>
                  <div className="flex gap-2">
                    {!isFirst && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWalkthroughStep((s) => s - 1)}
                      >
                        Back
                      </Button>
                    )}
                    {isLast ? (
                      <Button size="sm" onClick={closeWalkthrough}>
                        Finish
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setWalkthroughStep((s) => s + 1)}>
                        Next
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Mobile: compact header bar (Full Details style) */}
      <div
        data-walkthrough="dashboard-intro-mobile"
        className="flex items-center justify-between gap-2 lg:hidden"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dashboard</p>
        <div className="flex items-center gap-1.5">
          <select
            className="h-8 rounded-lg border bg-card px-2.5 text-[11px] font-semibold text-muted-foreground outline-none transition-colors active:bg-muted focus:outline-none"
            value={selectedYearFilterValue}
            onChange={(event) =>
              setSelectedYear(event.target.value === "all" ? "all" : Number(event.target.value))
            }
          >
            <option value="all">All years</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Button variant="proposal" size="sm" asChild className="h-8 min-h-8">
            <Link href="/proposals/new">
              <Plus className="h-3 w-3" /> New Proposal
            </Link>
          </Button>
        </div>
      </div>

      {/* Desktop: page header card (consistent with My Workspace) */}
      <GlassCard data-walkthrough="dashboard-intro" className="hidden rounded-3xl lg:block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Dashboard</CardLabel>
            <CardValue>{selectedYearFilterValue === "all" ? "All years" : selectedYearFilterValue}</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Budget year runs from February 1, {selectedBudgetYear} to January 31, {selectedBudgetYear + 1}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {(() => {
                const toReviewCount = data.proposals.filter((p) => p.status === "to_review").length;
                const sentCount = data.proposals.filter((p) => p.status === "sent").length;
                return (
                  <>
                    {toReviewCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        {formatNumber(toReviewCount)} to review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        All reviewed
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">&middot; {formatNumber(sentCount)} sent &middot; {formatNumber(data.proposals.length)} total</span>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <select
              aria-label="Budget year"
              className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] block h-10 rounded-md border px-3 py-2 text-sm outline-none"
              value={selectedYearFilterValue}
              onChange={(event) =>
                setSelectedYear(event.target.value === "all" ? "all" : Number(event.target.value))
              }
            >
              <option value="all">All years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Button variant="proposal" asChild className="sm:min-h-11 sm:px-4 sm:text-sm">
              <Link href="/proposals/new" title="New Proposal (⇧N)">
                <Plus className="h-4 w-4" /> New Proposal
              </Link>
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-3 lg:hidden" data-walkthrough="dashboard-budget-mobile">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <DollarSign className="h-4 w-4" />
          </span>
          <CardLabel>Foundation <span className="font-semibold">Budget</span></CardLabel>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{currency(data.budget.total)}</p>
            <p className="text-[10px] text-muted-foreground">{Math.round(totalUtilization)}% used</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Joint</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{currency(data.budget.jointRemaining)}</p>
            <p className="text-[10px] text-muted-foreground">of {currency(data.budget.jointPool)}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Disc.</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{currency(data.budget.discretionaryRemaining)}</p>
            <p className="text-[10px] text-muted-foreground">of {currency(data.budget.discretionaryPool)}</p>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          Budget year runs from February 1, {selectedBudgetYear} to January 31, {selectedBudgetYear + 1}
        </p>
      </GlassCard>

      <section className="hidden lg:grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:auto-rows-fr" data-walkthrough="dashboard-budget">
          <MetricCard
            title={<>FOUNDATION TOTAL <span className="font-semibold">BUDGET</span></>}
            value={currency(data.budget.total)}
            subtitle={`Allocated: ${currency(totalAllocatedForYear)}`}
            icon={DollarSign}
            tone="emerald"
            className="sm:col-span-2"
          >
            <Progress
              value={Math.min(totalUtilization, 100)}
              className="mt-2 h-1.5 bg-muted"
              indicatorClassName={totalUtilization > 100 ? "bg-rose-500" : "bg-emerald-500 dark:bg-emerald-400"}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{Math.round(totalUtilization)}% utilized</p>
          </MetricCard>
          <MetricCard
            title={<>JOINT POOL <span className="font-semibold">REMAINING</span></>}
            value={currency(data.budget.jointRemaining)}
            subtitle={`Allocated: ${currency(data.budget.jointAllocated)}`}
            icon={Users}
            tone="indigo"
          >
            <Progress
              value={Math.min(jointUtilization, 100)}
              className="mt-2 h-1.5 bg-muted"
              indicatorClassName={jointUtilization > 100 ? "bg-rose-500" : "bg-indigo-500 dark:bg-indigo-400"}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{Math.round(jointUtilization)}% utilized</p>
          </MetricCard>
          <MetricCard
            title={<>DISCRETIONARY <span className="font-semibold">REMAINING</span></>}
            value={currency(data.budget.discretionaryRemaining)}
            subtitle={`Allocated: ${currency(data.budget.discretionaryAllocated)}`}
            icon={Wallet}
            tone="amber"
          >
            <Progress
              value={Math.min(discretionaryUtilization, 100)}
              className="mt-2 h-1.5 bg-muted"
              indicatorClassName={discretionaryUtilization > 100 ? "bg-rose-500" : "bg-amber-500 dark:bg-amber-400"}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{Math.round(discretionaryUtilization)}% utilized</p>
          </MetricCard>
        </div>
        <GlassCard data-walkthrough="dashboard-history">
          <CardLabel>Historical Impact</CardLabel>
          {historyData ? (
            historyData.historyByYear.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-muted-foreground">No historical data yet</p>
                <p className="text-xs text-muted-foreground">Sent grants will appear here once recorded.</p>
              </div>
            ) : (
              <HistoricalImpactChart data={historyData.historyByYear} />
            )
          ) : (
            <div className="h-[220px] w-full animate-pulse rounded-2xl bg-muted" />
          )}
          {!isHistoryLoading && historyError ? (
            <p className="mt-2 text-xs text-muted-foreground">Historical data is temporarily unavailable.</p>
          ) : null}
        </GlassCard>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)}>
      <GlassCard className="p-5" data-walkthrough="dashboard-tracker">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardLabel>{showPendingTab ? "Pending" : "Grant Tracker"}</CardLabel>
            <p className="text-xs text-muted-foreground">
              {showPendingTab
                ? "All budget years. Includes proposals not yet Sent or Declined."
                : "Statuses: To Review, Approved, Sent, Declined"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOversight ? (
              <TabsList>
                <TabsTrigger value="tracker">Grant Tracker</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
            ) : null}
            {!showPendingTab ? (
              <>
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
                      className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
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
              <p className="rounded-xl border p-4 text-sm text-muted-foreground">Loading pending proposals...</p>
            ) : pendingProposals.length === 0 ? (
              <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                No pending proposals across all budget years.
              </p>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="space-y-3 md:hidden">
                  {pendingProposals.map((proposal) => {
                    const masked = proposal.progress.masked && proposal.status === "to_review" && proposal.proposalType !== "discretionary";

                    return (
                      <article
                        key={proposal.id}
                        className={`rounded-xl border border-t-2 p-4 ${
                          proposal.proposalType === "joint"
                            ? "border-t-indigo-400 dark:border-t-indigo-500"
                            : "border-t-amber-400 dark:border-t-amber-500"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold">{proposal.title}</p>
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  proposal.proposalType === "joint"
                                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                }`}
                              >
                                {proposal.proposalType === "joint" ? "Joint" : "Discretionary"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Budget year {proposal.budgetYear}</p>
                          </div>
                          <StatusPill status={proposal.status} />
                        </div>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {masked && proposal.proposalType !== "joint" ? "Blind until voted" : proposal.proposalType === "joint" && proposal.status === "to_review" ? currency(proposal.proposedAmount) : currency(proposal.progress.computedFinalAmount)}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p>{buildPendingActionRequiredLabel(proposal)}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <table className="hidden min-w-[860px] table-auto text-left text-sm md:table">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2">Proposal</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Amount</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Required Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingProposals.map((proposal) => {
                      const masked = proposal.progress.masked && proposal.status === "to_review" && proposal.proposalType !== "discretionary";

                      return (
                        <tr key={proposal.id} className="border-b align-top">
                          <td className="px-2 py-3">
                            <p className="font-semibold">{proposal.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Budget year {proposal.budgetYear}</p>
                          </td>
                          <td className="px-2 py-3 text-xs text-muted-foreground">
                            {titleCase(proposal.proposalType)}
                          </td>
                          <td className="px-2 py-3 text-xs text-muted-foreground">
                            {masked && proposal.proposalType !== "joint"
                              ? "Blind until your vote is submitted"
                              : proposal.proposalType === "joint" && proposal.status === "to_review"
                              ? currency(proposal.proposedAmount)
                              : currency(proposal.progress.computedFinalAmount)}
                          </td>
                          <td className="px-2 py-3">
                            <StatusPill status={proposal.status} />
                          </td>
                          <td className="px-2 py-3 text-xs text-muted-foreground">
                            {buildPendingActionRequiredLabel(proposal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {formatNumber(filteredAndSortedProposals.length)} proposal{filteredAndSortedProposals.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-muted-foreground">for {selectedBudgetYearLabel}</span>
              </div>
              <div className="hidden md:block">
                <DropdownMenu open={isExportMenuOpen} onOpenChange={(open) => { setIsExportMenuOpen(open); if (open) setExportMessage(null); }}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-3.5 w-3.5" />
                      Export
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExportMenuOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="text-xs font-semibold" onSelect={exportPdf}>
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs font-semibold" onSelect={exportCsv}>
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs font-semibold" onSelect={exportExcel}>
                      Export as Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs font-semibold" onSelect={() => { void exportGoogleSheet(); }}>
                      Export to Google Sheet
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <FilterPanel className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,8rem)_auto] xl:items-end">
              <label className="text-xs font-semibold text-muted-foreground flex flex-col">
                Search
                <Input
                  type="text"
                  value={filters.proposal}
                  onChange={(event) => setFilter("proposal", event.target.value)}
                  placeholder="Title or description"
                  className="mt-1 h-9 normal-case"
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground flex flex-col">
                Type
                <select
                  value={filters.proposalType}
                  onChange={(event) =>
                    setFilter("proposalType", event.target.value as TableFilters["proposalType"])
                  }
                  className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-md border px-3 py-1 text-base outline-none md:text-sm mt-1 normal-case"
                >
                  <option value="all">All</option>
                  <option value="joint">Joint</option>
                  <option value="discretionary">Discretionary</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted-foreground flex flex-col">
                Status
                <select
                  value={filters.status}
                  onChange={(event) => setFilter("status", event.target.value as TableFilters["status"])}
                  className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-md border px-3 py-1 text-base outline-none md:text-sm mt-1 normal-case"
                >
                  <option value="all">All</option>
                  {STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {titleCase(statusOption)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted-foreground flex flex-col">
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={filters.myActions}
                    onChange={(event) => setFilter("myActions", event.target.checked)}
                    className="h-3.5 w-3.5 accent-[hsl(var(--accent))] rounded border border-border"
                  />
                  My Actions
                </span>
                <span className="mt-1 text-[10px] normal-case text-muted-foreground">Only proposals requiring my action</span>
              </label>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearTrackerFilters}
                  className="h-9 w-full xl:w-auto"
                >
                  Clear filters
                </Button>
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
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              No proposals match the current filters for {selectedBudgetYearLabel}.
            </p>
          ) : (
            filteredAndSortedProposals.map((proposal) => {
              const draft = drafts[proposal.id] ?? toProposalDraft(proposal);
              const masked = proposal.progress.masked && proposal.status === "to_review" && proposal.proposalType !== "discretionary";
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
                  : "text-foreground";

              return (
                <article key={proposal.id} className={`rounded-xl border border-t-2 p-4 ${
                  proposal.proposalType === "joint"
                    ? "border-t-indigo-400 dark:border-t-indigo-500"
                    : "border-t-amber-400 dark:border-t-amber-500"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold">{proposal.title}</p>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            proposal.proposalType === "joint"
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}
                        >
                          {proposal.proposalType === "joint" ? "Joint" : "Discretionary"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{proposal.description}</p>
                    </div>
                    <StatusPill status={proposal.status} />
                  </div>

                  {!isRowEditable ? (
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {masked && proposal.proposalType !== "joint"
                        ? "Blind until your vote is submitted"
                        : proposal.proposalType === "joint" && proposal.status === "to_review"
                        ? currency(proposal.proposedAmount)
                        : currency(proposal.progress.computedFinalAmount)}
                    </p>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Type</span>
                      <p className="font-medium text-foreground">{titleCase(proposal.proposalType)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sent</span>
                      <p className="font-medium text-foreground">
                        {proposal.sentAt
                          ? new Date(proposal.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-border/70 bg-muted/50 p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Required Action
                    </p>
                    <p className={`mt-1 text-xs ${requiredActionToneClass}`}>
                      <span className="font-semibold">{requiredAction.owner}:</span>{" "}
                      {requiredAction.detail}
                    </p>
                    {requiredAction.href && requiredAction.ctaLabel ? (
                      <Link
                        href={requiredAction.href}
                        className="mt-2 inline-flex rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                      >
                        {requiredAction.ctaLabel}
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Amount</p>
                      {isRowEditable ? (
                        <>
                          <AmountInput
                            min={0}
                            step="0.01"
                            value={draft.finalAmount}
                            onChange={(event) => updateDraft(proposal.id, { finalAmount: event.target.value })}
                            className="mt-1"
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Amount preview: {parsedDraftFinalAmount !== null ? currency(parsedDraftFinalAmount) : "—"}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-foreground">
                          {masked && proposal.proposalType !== "joint"
                            ? "Blind until your vote is submitted"
                            : proposal.proposalType === "joint" && proposal.status === "to_review"
                            ? currency(proposal.proposedAmount)
                            : currency(proposal.progress.computedFinalAmount)}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Status</p>
                      {isRowEditable ? (
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft(proposal.id, {
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
                      ) : (
                        <p className="text-sm text-foreground">
                          {titleCase(proposal.status)}
                        </p>
                      )}
                    </div>

                    {canEditSentDate ? (
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Date amount sent
                        <Input
                          type="date"
                          value={draft.sentAt}
                          disabled={sentDateDisabled}
                          onChange={(event) => updateDraft(proposal.id, { sentAt: event.target.value })}
                          className="mt-1"
                        />
                      </label>
                    ) : (
                      <p className="text-xs text-muted-foreground">Date amount sent: {proposal.sentAt ?? "—"}</p>
                    )}

                    {isRowEditable ? (
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Notes
                        <Input
                          type="text"
                          value={draft.notes}
                          onChange={(event) => updateDraft(proposal.id, { notes: event.target.value })}
                          placeholder="Optional notes"
                          className="mt-1"
                        />
                      </label>
                    ) : proposal.notes?.trim() ? (
                      <p className="text-xs text-muted-foreground">Notes: {proposal.notes}</p>
                    ) : null}

                    {!canEditHistorical && isOwnProposal && proposal.status === "sent" ? (
                      <Button
                        type="button"
                        disabled={savingProposalId === proposal.id}
                        onClick={() => void saveProposalSentDate(proposal)}
                        className="w-full"
                      >
                        {savingProposalId === proposal.id ? "Saving..." : "Save date"}
                      </Button>
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
                          mutateAllFoundation();
                          void globalMutate("/api/workspace");
                          if (isOversight) {
                            void mutatePending();
                          }
                        }}
                        maxJointAllocation={
                          proposal.proposalType === "joint" && workspace
                            ? workspace.personalBudget.jointRemaining +
                              workspace.personalBudget.discretionaryRemaining
                            : undefined
                        }
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
                      className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
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
                    Proposal<SortIcon k="proposal" />
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("type")}>
                    Type<SortIcon k="type" />
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("amount")}>
                    Amount<SortIcon k="amount" />
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("sentAt")}>
                    Date Sent<SortIcon k="sentAt" />
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">
                  <DataTableSortButton onClick={() => toggleSort("status")}>
                    Status<SortIcon k="status" />
                  </DataTableSortButton>
                </th>
                <th className="px-2 py-3">Required Action</th>
                <th className="px-2 py-3 text-right">Details</th>
              </DataTableHeadRow>
            </thead>
            <tbody>
              {filteredAndSortedProposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No proposals match the current filters for {selectedBudgetYearLabel}.
                  </td>
                </tr>
              ) : (
                filteredAndSortedProposals.map((proposal) => {
                  const draft = drafts[proposal.id] ?? toProposalDraft(proposal);
                  const masked = proposal.progress.masked && proposal.status === "to_review" && proposal.proposalType !== "discretionary";
                  const rowState = rowMessage[proposal.id];
                  const parsedDraftFinalAmount = parseNumberInput(draft.finalAmount);
                  const requiredAction = buildRequiredActionSummary(proposal, user?.role);
                  const requiredActionToneClass =
                    requiredAction.tone === "attention"
                      ? "text-amber-700 dark:text-amber-300"
                      : requiredAction.tone === "complete"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-foreground";
                  const showRequiredActionLink =
                    requiredAction.tone === "attention" &&
                    Boolean(requiredAction.href && requiredAction.ctaLabel);
                  const showRequiredActionOpenDetail =
                    requiredAction.tone === "attention" &&
                    Boolean(requiredAction.openDetail && requiredAction.ctaLabel);
                  const amountDisplay =
                    masked && proposal.proposalType !== "joint"
                      ? "Blind until your vote is submitted"
                      : proposal.proposalType === "joint" && proposal.status === "to_review"
                      ? currency(proposal.proposedAmount)
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
                      : "text-muted-foreground";
                  const statusDisplay = isHistoricalBulkEditEnabled ? draft.status : proposal.status;
                  const sentAtDisplay = isHistoricalBulkEditEnabled ? draft.sentAt || "—" : proposal.sentAt
                    ? new Date(proposal.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                    : "—";

                  const viewerMustAct =
                    requiredAction.tone === "attention" &&
                    (requiredAction.openDetail ||
                      (requiredAction.href === "/meeting" && (user?.role === "oversight" || user?.role === "manager")) ||
                      (requiredAction.href === "/admin" && user?.role === "admin"));

                  return (
                    <DataTableRow
                      key={proposal.id}
                      className={viewerMustAct ? "border-l-2 border-l-amber-400 dark:border-l-amber-500" : ""}
                    >
                      <td className="w-[20rem] max-w-[20rem] px-2 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailProposalId(proposal.id)}
                          className="block max-w-full truncate font-semibold hover:underline hover:text-primary transition-colors text-left"
                          title={proposal.title}
                        >
                          {proposal.title}
                        </button>
                        <p
                          className="mt-1 block max-w-full truncate text-xs text-muted-foreground"
                          title={proposal.description}
                        >
                          {proposal.description}
                        </p>
                        {isAllYearsView ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground/70">Budget year {proposal.budgetYear}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">{titleCase(proposal.proposalType)}</td>
                      <td className="px-2 py-3 text-xs">
                        <p className={amountToneClass}>{amountDisplay}</p>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">{sentAtDisplay}</td>
                      <td className="px-2 py-3">
                        <StatusPill status={statusDisplay} />
                      </td>
                      <td className="px-2 py-3">
                        <p className={`text-xs ${requiredActionToneClass}`}>
                          <span className="font-semibold">{requiredAction.owner}:</span> {requiredAction.detail}
                        </p>
                        {showRequiredActionLink ? (
                          <Link
                            href={requiredAction.href!}
                            className="mt-2 inline-flex rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                          >
                            {requiredAction.ctaLabel}
                          </Link>
                        ) : null}
                        {showRequiredActionOpenDetail ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 h-auto rounded-md border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                            onClick={() => setDetailProposalId(proposal.id)}
                          >
                            {requiredAction.ctaLabel}
                          </Button>
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
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setDetailProposalId(proposal.id)}
                          aria-label={`View details for ${proposal.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
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
      </GlassCard>
      </Tabs>

      <ResponsiveModal
        open={!!(detailProposal && detailDraft && detailRequiredAction)}
        onOpenChange={(open) => { if (!open) closeDetailDrawer(); }}
      >
        {detailProposal && detailDraft && detailRequiredAction ? (
        <ResponsiveModalContent
          aria-labelledby="proposal-details-title"
          dialogClassName="max-w-3xl rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto"
          showCloseButton={false}
          footer={
            user &&
            canVote &&
            detailProposal.status === "to_review" &&
            !detailProposal.progress.hasCurrentUserVoted ? (
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle id="proposal-details-title" className="text-lg font-bold">
                    Proposal Details
                  </DialogTitle>
                  <Badge className={detailProposal.proposalType === "joint"
                    ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
                    : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
                  }>
                    {titleCase(detailProposal.proposalType)}
                  </Badge>
                  <StatusPill status={detailProposal.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{detailProposal.title}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={closeDetailDrawer}
                aria-label="Close proposal details"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-muted/60 p-4 text-sm md:grid-cols-2">
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proposal</dt>
                <dd className="mt-1.5 font-semibold text-foreground">{detailProposal.title}</dd>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {detailProposal.description || "—"}
                </p>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</dt>
                <dd className="mt-1.5 font-semibold text-foreground">{titleCase(detailProposal.proposalType)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</dt>
                <dd className="mt-1.5 text-lg font-bold text-foreground">
                  {detailMasked && detailProposal?.proposalType !== "joint"
                    ? "Blind until your vote is submitted"
                    : detailProposal?.proposalType === "joint" && detailProposal.status === "to_review"
                    ? currency(detailProposal.proposedAmount)
                    : currency(detailProposal.progress.computedFinalAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date Sent</dt>
                <dd className="mt-1.5 font-semibold text-foreground">
                  {detailProposal.sentAt
                    ? new Date(detailProposal.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</dt>
                <dd className="mt-1.5 font-semibold text-foreground">{titleCase(detailProposal.status)}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Required Action</dt>
                <dd className={`mt-1.5 ${detailRequiredActionToneClass}`}>
                  <span className="font-semibold">{detailRequiredAction.owner}:</span>{" "}
                  {detailRequiredAction.detail}
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
                            This charity&apos;s score is {Math.round(detailProposal.charityNavigatorScore)}%, earning it a{" "}
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
              <div className="md:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</dt>
                <dd className="mt-1.5 whitespace-pre-wrap font-semibold text-foreground">{detailProposal.notes?.trim() || "—"}</dd>
              </div>
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
                        updateDraft(detailProposal.id, { finalAmount: event.target.value })
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
                        updateDraft(detailProposal.id, {
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
                      onChange={(event) => updateDraft(detailProposal.id, { sentAt: event.target.value })}
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
                      onChange={(event) => updateDraft(detailProposal.id, { notes: event.target.value })}
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
                {detailEditError ? (
                  <p className="mt-3 text-xs text-rose-600">{detailEditError}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailEditDraft(toProposalDetailEditDraft(detailProposal));
                      setIsDetailEditMode(false);
                      setDetailEditError(null);
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
                      setDetailEditError(null);
                      return;
                    }
                    setDetailEditDraft(toProposalDetailEditDraft(detailProposal));
                    setDetailEditError(null);
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
                  onClick={() => void saveProposalSentDate(detailProposal)}
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
        </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>
    </div>
  );
}
