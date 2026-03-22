"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowDownAZ, ArrowUpAZ, Banknote, ChevronDown, DollarSign, Download, History, Landmark, MoreHorizontal, Pencil, PieChart, Plus, RefreshCw, Trash2, Upload, Users, X } from "lucide-react";
const FrankDeenieYearSplitChart = dynamic(
  () => import("@/components/frank-deenie/year-split-chart").then((mod) => mod.FrankDeenieYearSplitChart),
  { ssr: false, loading: () => <div className="h-[180px] w-full animate-pulse rounded-2xl bg-muted" /> }
);
const CharityGivingHistory = dynamic(
  () => import("@/components/charity-giving-history").then((mod) => mod.CharityGivingHistory),
  { ssr: false, loading: () => <div className="space-y-3 p-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /><div className="h-24 w-full animate-pulse rounded bg-muted" /></div> }
);
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { DataTableHeadRow, DataTableRow, DataTableSortButton } from "@/components/ui/data-table";
import { FilterPanel } from "@/components/ui/filter-panel";
import { MetricCard } from "@/components/ui/metric-card";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AddDonationForm } from "./add-donation-form";
import { DonationDetailDrawer, DetailMode } from "./donation-detail-drawer";
import { ReturnCheckForm } from "./return-check-form";
import { FoundationEventForm } from "./foundation-event-form";
import { getProposerDisplayName } from "@/lib/proposer-display-names";
import { FoundationEvent, FoundationEventType, FrankDeenieDonationRow, FrankDeenieSnapshot, UserProfile, YearMode } from "@/lib/types";
import { SkeletonCard } from "@/components/ui/skeleton";
import { RevalidatingDot } from "@/components/ui/revalidating-dot";
import { compactCurrency, currency, formatNumber, toISODate } from "@/lib/utils";
import { PageWithSidebar } from "@/components/ui/page-with-sidebar";

type SortKey = "date" | "name" | "memo" | "amount" | "status";
type SortDirection = "asc" | "desc";

interface DonationFilters {
  search: string;
  status: string;
}

interface DonationExportRow {
  date: string;
  name: string;
  memo: string;
  amount: number;
  status: string;
  source: string;
  proposedBy: string;
  returnStatus: string;
}

const DEFAULT_FILTERS: DonationFilters = {
  search: "",
  status: "all"
};

const DONATION_STATUSES = ["Gave", "Planned"] as const;
const SHOW_FRANK_DEENIE_IMPORT = false;
const EXPORT_HEADERS = ["Date", "Name", "Notes", "Amount", "Status", "Source", "Proposed by", "Return Status"] as const;

interface FoundationEventExportRow {
  date: string;
  type: string;
  amount: number;
  memo: string;
}

const FOUNDATION_EVENT_HEADERS = ["Date", "Type", "Amount", "Memo"] as const;
const YEAR_MODE_KEY = "frank-deenie-year-mode";

function givingYearFromDate(isoDate: string): number {
  const month = Number(isoDate.slice(5, 7));
  const year = Number(isoDate.slice(0, 4));
  return month <= 1 ? year - 1 : year;
}

function yearFromDate(isoDate: string, mode: YearMode): number {
  return mode === "giving" ? givingYearFromDate(isoDate) : Number(isoDate.slice(0, 4));
}

function givingYearLabel(year: number): string {
  return `${year}\u2013${String(year + 1).slice(2)}`;
}

function yearLabel(year: number, mode: YearMode): string {
  return mode === "giving" ? givingYearLabel(year) : String(year);
}

function readStoredYearMode(): YearMode {
  if (typeof window === "undefined") return "calendar";
  const stored = localStorage.getItem(YEAR_MODE_KEY);
  return stored === "giving" ? "giving" : "calendar";
}

function proposerName(email: string) {
  return getProposerDisplayName(email);
}

/** Display value for the "By" column: F&D for non-children donations, otherwise the proposer name. */
function byDisplay(row: FrankDeenieDonationRow): string {
  if (row.source === "children") {
    return row.proposedBy ? proposerName(row.proposedBy) : "—";
  }
  return "F&D";
}

function tableDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function normalized(value: string) {
  return value.trim().toLowerCase();
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

function rowToExportValues(row: DonationExportRow) {
  return [
    row.date,
    row.name,
    row.memo,
    row.amount.toFixed(2),
    row.status,
    row.source,
    row.proposedBy,
    row.returnStatus
  ];
}

function eventRowToExportValues(row: FoundationEventExportRow) {
  return [row.date, row.type, row.amount.toFixed(2), row.memo];
}

function buildCsv(rows: DonationExportRow[], eventRows: FoundationEventExportRow[]) {
  const headerLine = EXPORT_HEADERS.join(",");
  const dataLines = rows.map((row) => rowToExportValues(row).map(escapeCsvField).join(","));
  const parts = [headerLine, ...dataLines];
  if (eventRows.length > 0) {
    const eventHeaderLine = FOUNDATION_EVENT_HEADERS.join(",");
    const eventDataLines = eventRows.map((row) => eventRowToExportValues(row).map(escapeCsvField).join(","));
    parts.push("", "Foundation Events", eventHeaderLine, ...eventDataLines);
  }
  return parts.join("\n");
}

function buildTsv(rows: DonationExportRow[], eventRows: FoundationEventExportRow[]) {
  const sanitize = (value: string) => value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  const headerLine = EXPORT_HEADERS.join("\t");
  const dataLines = rows.map((row) => rowToExportValues(row).map(sanitize).join("\t"));
  const parts = [headerLine, ...dataLines];
  if (eventRows.length > 0) {
    const eventHeaderLine = FOUNDATION_EVENT_HEADERS.join("\t");
    const eventDataLines = eventRows.map((row) => eventRowToExportValues(row).map(sanitize).join("\t"));
    parts.push("", "Foundation Events", eventHeaderLine, ...eventDataLines);
  }
  return parts.join("\n");
}

function buildExcelHtml(rows: DonationExportRow[], title: string, subtitle: string, eventRows: FoundationEventExportRow[]) {
  const donCols = EXPORT_HEADERS.length;
  const hasEvents = eventRows.length > 0;
  const totalCols = hasEvents ? donCols + 1 + FOUNDATION_EVENT_HEADERS.length : donCols;

  const titleRow = `<tr><td colspan="${totalCols}" style="font-size: 18px; font-weight: 700; border: none;">${escapeHtml(title)}</td></tr>`;
  const subtitleRow = `<tr><td colspan="${totalCols}" style="font-size: 12px; color: #555; border: none;">${escapeHtml(subtitle)}</td></tr>`;
  const spacerRow = `<tr><td colspan="${totalCols}" style="border: none;">&nbsp;</td></tr>`;

  const donHeaders = EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const eventHeaders = hasEvents
    ? `<td style="border: none;"></td>` + FOUNDATION_EVENT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("")
    : "";
  const headerRow = `<tr>${donHeaders}${eventHeaders}</tr>`;

  const maxRows = Math.max(rows.length, eventRows.length);
  const emptyDonCells = `<td style="border: none;"></td>`.repeat(donCols);
  const emptyEventCells = hasEvents ? `<td style="border: none;"></td><td style="border: none;"></td><td style="border: none;"></td><td style="border: none;"></td><td style="border: none;"></td>` : "";
  const dataRows = Array.from({ length: maxRows }, (_, i) => {
    const donCells = i < rows.length
      ? rowToExportValues(rows[i]).map((v) => `<td>${escapeHtml(v)}</td>`).join("")
      : emptyDonCells;
    const evtCells = hasEvents
      ? (i < eventRows.length
        ? `<td style="border: none;"></td>` + eventRowToExportValues(eventRows[i]).map((v) => `<td>${escapeHtml(v)}</td>`).join("")
        : emptyEventCells)
      : "";
    return `<tr>${donCells}${evtCells}</tr>`;
  }).join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #d4d4d8; padding: 6px 8px; font-size: 12px; text-align: left; }
      th { background: #f4f4f5; font-weight: 700; }
    </style>
  </head>
  <body>
    <table>
      ${titleRow}
      ${subtitleRow}
      ${spacerRow}
      ${headerRow}
      ${dataRows}
    </table>
  </body>
</html>`;
}

function buildPrintableHtml(rows: DonationExportRow[], title: string, subtitle: string, eventRows: FoundationEventExportRow[]) {
  const head = EXPORT_HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = rowToExportValues(row).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  let eventsHtml = "";
  if (eventRows.length > 0) {
    const eventHead = FOUNDATION_EVENT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const eventBody = eventRows
      .map((row) => {
        const cells = eventRowToExportValues(row).map((v) => `<td>${escapeHtml(v)}</td>`).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    eventsHtml = `
      <div>
        <h2 style="margin: 0 0 8px; font-size: 15px;">Foundation Events</h2>
        <table>
          <thead><tr>${eventHead}</tr></thead>
          <tbody>${eventBody}</tbody>
        </table>
      </div>`;
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 0.5in; size: landscape; }
      body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; }
      h1 { margin: 0 0 6px; font-size: 18px; }
      p { margin: 0 0 12px; color: #475569; font-size: 12px; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: left; vertical-align: top; }
      th { background: #e2e8f0; font-weight: 700; }
      .tables { display: flex; gap: 24px; align-items: flex-start; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    <div class="tables">
      <div>
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>${eventsHtml}
    </div>
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

interface FrankDeenieClientProps {
  profile: UserProfile;
  initialSnapshot: FrankDeenieSnapshot;
  initialNameSuggestions: string[];
}

export default function FrankDeenieClient({ profile, initialSnapshot, initialNameSuggestions }: FrankDeenieClientProps) {
  const isAdmin = profile.role === "admin";
  const readOnly = profile.role === "member";

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearMode, setYearModeRaw] = useState<YearMode>(readStoredYearMode);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [filters, setFilters] = useState<DonationFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [importCsvFile, setImportCsvFile] = useState<File | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importInputKey, setImportInputKey] = useState(0);
  const [importExpanded, setImportExpanded] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<FrankDeenieDonationRow | null>(null);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  
  const [isFilterNameOpen, setIsFilterNameOpen] = useState(false);
  const [chartDrilldownYear, setChartDrilldownYear] = useState<number | null>(null);
  const [drilldownSortKey, setDrilldownSortKey] = useState<"date" | "name" | "amount" | "status">("date");
  const [drilldownSortDir, setDrilldownSortDir] = useState<"asc" | "desc">("desc");
  const [givingHistoryName, setGivingHistoryName] = useState<string | null>(null);
  const [givingHistoryFuzzy, setGivingHistoryFuzzy] = useState(false);
  const [givingHistoryNames, setGivingHistoryNames] = useState<string[] | null>(null);
  const [excludedFilterNames, setExcludedFilterNames] = useState<Set<string>>(new Set());
  const [returnRow, setReturnRow] = useState<FrankDeenieDonationRow | null>(null);
  const [foundationEventType, setFoundationEventType] = useState<FoundationEventType | null>(null);
  const [editingFoundationEvent, setEditingFoundationEvent] = useState<FoundationEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const MOBILE_PAGE_SIZE = 50;
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const filterNameInputRef = useRef<HTMLInputElement | null>(null);

  const setYearMode = useCallback((mode: YearMode) => {
    setYearModeRaw(mode);
    localStorage.setItem(YEAR_MODE_KEY, mode);
    setSelectedYear(null);
  }, []);

  const nameSuggestionsQuery = useSWR<{ names: string[] }>("/api/frank-deenie/name-suggestions", {
    fallbackData: { names: initialNameSuggestions },
    revalidateOnMount: false
  });
  const allNameSuggestions = useMemo(
    () => nameSuggestionsQuery.data?.names ?? [],
    [nameSuggestionsQuery.data]
  );
  const normalizedFilterSearch = useMemo(() => filters.search.trim().toLowerCase(), [filters.search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("includeChildren", includeChildren ? "1" : "0");
    if (yearMode !== "calendar") {
      params.set("yearMode", yearMode);
    }
    if (selectedYear !== null) {
      params.set("year", String(selectedYear));
    }
    return params.toString();
  }, [includeChildren, yearMode, selectedYear]);

  const defaultQueryString = "includeChildren=0";
  const hasSnapshotFallback = queryString === defaultQueryString;
  const { data, error, isLoading, isValidating, mutate } = useSWR<FrankDeenieSnapshot>(
    `/api/frank-deenie?${queryString}`,
    {
      refreshInterval: 120_000,
      fallbackData: hasSnapshotFallback ? initialSnapshot : undefined,
      revalidateOnMount: !hasSnapshotFallback
    }
  );

  const filterableNames = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const row of data.rows) {
      const key = row.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(row.name.trim());
    }
    return names.sort((a, b) => a.localeCompare(b));
  }, [data]);
  const filterNameSuggestions = useMemo(() => {
    if (!filterableNames.length) return [];
    if (!normalizedFilterSearch) return filterableNames.slice(0, 16);

    const startsWithMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const name of filterableNames) {
      const norm = name.trim().toLowerCase();
      if (!norm.includes(normalizedFilterSearch)) continue;
      if (norm.startsWith(normalizedFilterSearch)) {
        startsWithMatches.push(name);
      } else {
        containsMatches.push(name);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 16);
  }, [filterableNames, normalizedFilterSearch]);
  const showFilterNamePanel =
    isFilterNameOpen && (filterNameSuggestions.length > 0 || normalizedFilterSearch.length > 0);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (selectedYear !== null && !data.availableYears.includes(selectedYear)) {
      setSelectedYear(null);
    }
  }, [data, selectedYear]);

  useEffect(() => {
    if (!detailRowId) {
      return;
    }

    const rowStillExists = data?.rows.some((row) => row.id === detailRowId) ?? false;
    if (!rowStillExists) {
      setDetailRowId(null);
    }
  }, [data, detailRowId]);

  const filteredRows = useMemo(() => {
    if (!data) {
      return [];
    }

    const search = normalized(filters.search);

    const scopedRows = data.rows.filter((row) => {
      if (filters.status !== "all" && row.status !== filters.status) {
        return false;
      }

      if (search) {
        if (!row.name.toLowerCase().includes(search)) {
          return false;
        }
        if (excludedFilterNames.size > 0 && excludedFilterNames.has(row.name.trim())) {
          return false;
        }
      }

      return true;
    });

    return [...scopedRows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "date") {
        comparison = a.date.localeCompare(b.date);
      } else if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === "memo") {
        comparison = a.memo.localeCompare(b.memo);
      } else if (sortKey === "amount") {
        comparison = a.amount - b.amount;
      } else if (sortKey === "status") {
        comparison = a.status.localeCompare(b.status);
      }

      if (comparison === 0) {
        comparison = b.date.localeCompare(a.date);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, filters, excludedFilterNames, sortDirection, sortKey]);

  useEffect(() => {
    setMobileVisibleCount(MOBILE_PAGE_SIZE);
  }, [filters, selectedYear, sortKey, sortDirection]);

  const mobileRows = filteredRows.slice(0, mobileVisibleCount);
  const hasMoreMobileRows = filteredRows.length > mobileVisibleCount;

  const detailRow = useMemo(() => {
    if (!data || !detailRowId) {
      return null;
    }

    return data.rows.find((row) => row.id === detailRowId) ?? null;
  }, [data, detailRowId]);

  const filteredOrgNames = useMemo(() => {
    if (!filters.search.trim()) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const row of filteredRows) {
      const key = row.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(row.name.trim());
    }
    return names.sort((a, b) => a.localeCompare(b));
  }, [filteredRows, filters.search]);

  const includedFilterNames = useMemo(
    () => filteredOrgNames.filter((n) => !excludedFilterNames.has(n)),
    [filteredOrgNames, excludedFilterNames]
  );

  useEffect(() => {
    setExcludedFilterNames(new Set());
  }, [filters.search]);

  const visibleTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.amount, 0),
    [filteredRows]
  );
  const selectedYearLabel = selectedYear === null ? "all years" : yearLabel(selectedYear, yearMode);
  const exportRows = useMemo<DonationExportRow[]>(
    () =>
      filteredRows.map((row) => ({
        date: row.date,
        name: row.name.trim(),
        memo: row.memo.trim(),
        amount: row.amount,
        status: row.status.trim(),
        source: row.source === "children" ? "Children" : "Frank & Deenie",
        proposedBy: byDisplay(row),
        returnStatus: row.returnRole === "original" ? "Returned" : row.returnRole === "reversal" ? "Reversal" : row.returnRole === "replacement" ? "Reissued" : ""
      })),
    [filteredRows]
  );
  const foundationEventExportRows = useMemo<FoundationEventExportRow[]>(
    () =>
      (data?.foundationEvents ?? []).map((evt) => ({
        date: evt.eventDate,
        type: evt.eventType === "fund_foundation" ? "Fund Foundation" : "Transfer into Foundation",
        amount: evt.amount,
        memo: evt.memo.trim()
      })),
    [data?.foundationEvents]
  );
  const exportFilenameBase = useMemo(() => {
    const modePart = yearMode === "giving" ? "giving" : "calendar";
    const yearPart = selectedYear === null ? "all-years" : `${modePart}-${selectedYear}`;
    const childrenPart = includeChildren ? "with-children" : "frank-deenie-only";
    return `frank-deenie-${yearPart}-${childrenPart}-${toISODate(new Date())}`;
  }, [includeChildren, yearMode, selectedYear]);
  const chartYearFormatter = useCallback(
    (yr: number) => yearLabel(yr, yearMode),
    [yearMode]
  );
  const exportTitle = "Frank & Deenie Donation Ledger";
  const yearModeLabel = yearMode === "giving" ? "Giving Year" : "Calendar Year";
  const exportSubtitle = `${
    selectedYear === null ? "All years" : `${yearModeLabel} ${yearLabel(selectedYear, yearMode)}`
  } | ${includeChildren ? "Includes Children" : "Frank & Deenie only"} | ${formatNumber(exportRows.length)} rows`;
  const yearSplitChartData = useMemo(() => {
    if (!filteredRows.length) {
      return [];
    }

    const byYear = new Map<number, { frankDeenie: number; children: number }>();

    for (const row of filteredRows) {
      const yr = yearFromDate(row.date, yearMode);
      if (!byYear.has(yr)) {
        byYear.set(yr, { frankDeenie: 0, children: 0 });
      }
      const bucket = byYear.get(yr)!;
      if (row.source === "children") {
        bucket.children += row.amount;
      } else {
        bucket.frankDeenie += row.amount;
      }
    }

    return Array.from(byYear.entries())
      .sort(([a], [b]) => a - b)
      .map(([yr, totals]) => ({ year: yr, ...totals }));
  }, [filteredRows, yearMode]);

  const chartDrilldownRows = useMemo(() => {
    if (chartDrilldownYear === null) return [];
    const rows = filteredRows.filter((row) => yearFromDate(row.date, yearMode) === chartDrilldownYear);
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (drilldownSortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (drilldownSortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (drilldownSortKey === "amount") cmp = a.amount - b.amount;
      else if (drilldownSortKey === "status") cmp = a.status.localeCompare(b.status);
      if (cmp === 0) cmp = b.date.localeCompare(a.date);
      return drilldownSortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, yearMode, chartDrilldownYear, drilldownSortKey, drilldownSortDir]);

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "date" ? "desc" : "asc");
  };

  const sortMarker = (key: SortKey) => {
    if (sortKey !== key) {
      return "";
    }

    return sortDirection === "asc" ? " ^" : " v";
  };

  const setFilter = <K extends keyof DonationFilters>(key: K, value: DonationFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openAddForm = useCallback(() => setShowAddForm(true), []);
  const closeAddForm = useCallback(() => setShowAddForm(false), []);

  const closeDetailDrawer = useCallback(() => {
    setDetailRowId(null);
    setDetailMode("view");
  }, []);

  const requestDelete = (row: FrankDeenieDonationRow) => {
    if (!row.editable) return;
    setDeleteConfirmRow(row);
  };

  const executeDelete = async () => {
    if (!deleteConfirmRow) return;

    const row = deleteConfirmRow;
    setDeleteConfirmRow(null);
    setDeletingRowId(row.id);

    if (detailRowId === row.id) {
      setDetailRowId(null);
    }

    try {
      await mutate(
        async () => {
          const response = await fetch(`/api/frank-deenie/${row.id}`, { method: "DELETE" });
          const payload = await response.json().catch(() => ({} as Record<string, unknown>));
          if (!response.ok) {
            throw new Error(String(payload.error ?? "Failed to delete donation."));
          }
          return undefined as unknown as FrankDeenieSnapshot;
        },
        {
          optimisticData: (current) =>
            current
              ? {
                  ...current,
                  rows: current.rows.filter((r) => r.id !== row.id),
                  totals: {
                    ...current.totals,
                    overall: current.totals.overall - row.amount,
                    ...(row.source === "frank_deenie"
                      ? { frankDeenie: current.totals.frankDeenie - row.amount }
                      : { children: current.totals.children - row.amount }),
                  },
                }
              : current!,
          populateCache: false,
          rollbackOnError: true,
          revalidate: true,
        },
      );
      toast.success("Donation deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete donation.");
    } finally {
      setDeletingRowId(null);
    }
  };

  const handleReturnClose = useCallback(() => setReturnRow(null), []);
  const handleReturnDone = useCallback(() => {
    setReturnRow(null);
    setDetailRowId(null);
    void mutate();
  }, [mutate]);

  const handleFoundationEventClose = useCallback(() => {
    setFoundationEventType(null);
    setEditingFoundationEvent(null);
  }, []);
  const handleFoundationEventSaved = useCallback(() => {
    setFoundationEventType(null);
    setEditingFoundationEvent(null);
    void mutate();
  }, [mutate]);

  const handleDetailMutate = useCallback(() => void mutate(), [mutate]);
  const handleDetailBeginReturn = useCallback((row: FrankDeenieDonationRow) => setReturnRow(row), []);
  const handleDetailRequestDelete = useCallback((row: FrankDeenieDonationRow) => {
    if (!row.editable) return;
    setDeleteConfirmRow(row);
  }, []);
  const handleDetailViewHistory = useCallback((name: string) => {
    setGivingHistoryName(name);
    setGivingHistoryFuzzy(false);
    setGivingHistoryNames(null);
  }, []);

  const deleteFoundationEvent = useCallback(async (eventId: string) => {
    setDeletingEventId(eventId);
    try {
      const response = await fetch(`/api/frank-deenie/foundation-events/${eventId}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? "Failed to delete event.");
      }
      toast.success("Event deleted.");
      void mutate();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete event.");
    } finally {
      setDeletingEventId(null);
    }
  }, [mutate]);

  const handleYearClick = useCallback((year: number) => {
    setChartDrilldownYear(year);
    setDrilldownSortKey("date");
    setDrilldownSortDir("desc");
  }, []);

  const handleDonationCreated = useCallback(() => void mutate(), [mutate]);

  const importCsv = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importCsvFile) {
      toast.error("Select a CSV file before importing.");
      return;
    }

    setImportingCsv(true);

    try {
      const csvText = await importCsvFile.text();
      const response = await fetch("/api/frank-deenie/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to import donations CSV."));
      }

      const importedCount = Number(payload.importedCount ?? 0);
      const skippedCount = Number(payload.skippedCount ?? 0);

      toast.success(
        `Imported ${formatNumber(importedCount)} donations${
          skippedCount > 0 ? `, skipped ${formatNumber(skippedCount)} duplicates` : ""
        }.`
      );
      setImportCsvFile(null);
      setImportInputKey((current) => current + 1);
      void mutate();
    } catch (importError) {
      toast.error(importError instanceof Error ? importError.message : "Failed to import donations CSV.");
    } finally {
      setImportingCsv(false);
    }
  };

  const withExportRows = () => {
    if (exportRows.length > 0) {
      return true;
    }

    toast.error("No rows are available to export for the current filters.");
    return false;
  };

  const exportCsv = () => {
    if (!withExportRows()) {
      return;
    }

    downloadFile(`${exportFilenameBase}.csv`, buildCsv(exportRows, foundationEventExportRows), "text/csv;charset=utf-8");
    toast.success(`CSV exported (${formatNumber(exportRows.length)} rows).`);
    setIsExportMenuOpen(false);
  };

  const exportExcel = () => {
    if (!withExportRows()) {
      return;
    }

    downloadFile(
      `${exportFilenameBase}.xls`,
      buildExcelHtml(exportRows, exportTitle, exportSubtitle, foundationEventExportRows),
      "application/vnd.ms-excel;charset=utf-8"
    );
    toast.success(`Excel file exported (${formatNumber(exportRows.length)} rows).`);
    setIsExportMenuOpen(false);
  };

  const exportPdf = () => {
    if (!withExportRows()) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      toast.error("The PDF export window was blocked. Allow pop-ups and try again.");
      return;
    }

    printWindow.document.write(buildPrintableHtml(exportRows, exportTitle, exportSubtitle, foundationEventExportRows));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);

    toast.success("Print dialog opened. Choose Save as PDF to finish.");
    setIsExportMenuOpen(false);
  };

  const exportGoogleSheet = async () => {
    if (!withExportRows()) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(buildTsv(exportRows, foundationEventExportRows));

      window.open("https://docs.google.com/spreadsheets/create", "_blank", "noopener,noreferrer");

      toast.success("Copied rows for Google Sheets. Paste into cell A1 in the new sheet.");
      setIsExportMenuOpen(false);
    } catch {
      downloadFile(`${exportFilenameBase}.csv`, buildCsv(exportRows, foundationEventExportRows), "text/csv;charset=utf-8");
      window.open("https://docs.google.com/spreadsheets/create", "_blank", "noopener,noreferrer");
      toast.error("Clipboard access was blocked. Downloaded CSV instead; import that file in Google Sheets.");
      setIsExportMenuOpen(false);
    }
  };

  if (!data && isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-stack pb-6">
        {/* Mobile skeleton */}
        <div className="sm:hidden space-y-4">
          <GlassCard className="rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-9 flex-1 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
            </div>
          </GlassCard>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <GlassCard key={i} className="p-3.5">
                <div className="h-2 w-10 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-5 w-16 animate-pulse rounded bg-muted" />
              </GlassCard>
            ))}
          </div>
          <GlassCard>
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-[176px] animate-pulse rounded-2xl bg-muted" />
          </GlassCard>
          <GlassCard>
            <div className="h-9 animate-pulse rounded-lg bg-muted" />
            <div className="mt-3 space-y-0 divide-y divide-border/40">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="py-3.5">
                  <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                  <div className="mt-1.5 h-3.5 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Desktop skeleton */}
        <div className="hidden sm:block space-y-6">
          <GlassCard className="rounded-3xl">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
              <CardLabel>Frank &amp; Deenie</CardLabel>
            </div>
            <CardValue className="mt-1">Donation Ledger</CardValue>
            <div className="mt-3 h-4 w-48 animate-pulse rounded-lg bg-muted" />
          </GlassCard>
          <GlassCard className="min-h-0">
            <div className="mb-3 h-6 w-32 animate-pulse rounded-lg bg-muted" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </GlassCard>
          <div className="grid gap-3 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <GlassCard key={i}>
                <div className="h-4 w-24 animate-pulse rounded-lg bg-muted" />
                <div className="mt-2 h-8 w-32 animate-pulse rounded-lg bg-muted" />
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-stack pb-6">
        <GlassCard>
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full border border-rose-200 bg-rose-50 p-2 dark:border-rose-800 dark:bg-rose-950/20">
              <RefreshCw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1">
              <CardLabel>Donation Ledger Error</CardLabel>
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                Failed to load Frank &amp; Deenie donations{error ? `: ${error.message}` : "."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Please check your connection and try again. If the problem persists, contact support.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="lg" onClick={() => void mutate()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="page-stack pb-6">
      {/* Mobile hero: compact header */}
      <GlassCard className="rounded-3xl sm:hidden">
        <div className="flex items-center justify-between">
          <div>
            <span className="flex items-center gap-1.5"><CardLabel>F&amp;D Ledger</CardLabel><RevalidatingDot isValidating={isValidating} hasData={!!data} /></span>
            <p className="text-xs text-muted-foreground">
              {selectedYear === null ? "All years" : yearLabel(selectedYear, yearMode)} &middot; {formatNumber(filteredRows.length)} donations
            </p>
          </div>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </div>
        <div className="mt-2 flex items-center">
          <div className="inline-flex h-8 rounded-lg border border-border text-xs font-medium">
            <button
              type="button"
              className={`rounded-l-lg px-2.5 transition-colors ${yearMode === "calendar" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => setYearMode("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={`rounded-r-lg border-l border-border px-2.5 transition-colors ${yearMode === "giving" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => setYearMode("giving")}
            >
              Giving Year
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select
            aria-label="Year"
            className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 flex-1 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            value={selectedYear === null ? "all" : String(selectedYear)}
            onChange={(event) =>
              setSelectedYear(event.target.value === "all" ? null : Number(event.target.value))
            }
          >
            <option value="all">All years</option>
            {data.availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yearLabel(yr, yearMode)}
              </option>
            ))}
          </select>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:bg-muted/50 whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeChildren}
              onChange={(event) => setIncludeChildren(event.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--accent))]"
            />
            Children
          </label>
        </div>
        {!readOnly ? (
          <>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFoundationEventType("fund_foundation")}
                className="flex-1 text-xs"
              >
                <Landmark className="h-3.5 w-3.5" />
                Fund Foundation
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFoundationEventType("transfer_to_foundation")}
                className="flex-1 text-xs"
              >
                <Banknote className="h-3.5 w-3.5" />
                Transfer
              </Button>
            </div>
            <Button
              type="button"
              variant="prominent"
              size="sm"
              onClick={openAddForm}
              className="mt-2 w-full"
            >
              <Plus className="h-4 w-4" />
              Add Donation
            </Button>
          </>
        ) : null}
      </GlassCard>

      {/* Desktop hero: full header */}
      <GlassCard className="hidden rounded-3xl sm:block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="flex items-center gap-1.5"><CardLabel>Frank &amp; Deenie</CardLabel><RevalidatingDot isValidating={isValidating} hasData={!!data} /></span>
            <CardValue>Donation Ledger</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {yearMode === "giving"
                ? "Giving year: Feb 1 \u2013 Jan 31. For tax accounting periods."
                : "Track Frank & Deenie giving, with optional Children donations from this app."}
            </p>
          </div>
          <div className="flex w-auto flex-row items-end gap-2">
            <div className="inline-flex h-10 rounded-md border border-border text-sm font-medium">
              <button
                type="button"
                className={`rounded-l-md px-3 transition-colors ${yearMode === "calendar" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setYearMode("calendar")}
              >
                Calendar Year
              </button>
              <button
                type="button"
                className={`rounded-r-md border-l border-border px-3 transition-colors ${yearMode === "giving" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setYearMode("giving")}
              >
                Giving Year
              </button>
            </div>
            <select
              aria-label="Year"
              className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 rounded-md border px-3 py-2 text-sm outline-none"
              value={selectedYear === null ? "all" : String(selectedYear)}
              onChange={(event) =>
                setSelectedYear(event.target.value === "all" ? null : Number(event.target.value))
              }
            >
              <option value="all">All years</option>
              {data.availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yearLabel(yr, yearMode)}
                </option>
              ))}
            </select>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:bg-muted/50 whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={(event) => setIncludeChildren(event.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--accent))]"
              />
              Include Children
            </label>
            {!readOnly ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFoundationEventType("fund_foundation")}
                  className="min-h-10"
                >
                  <Landmark className="h-4 w-4" />
                  Fund Foundation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFoundationEventType("transfer_to_foundation")}
                  className="min-h-10"
                >
                  <Banknote className="h-4 w-4" />
                  Transfer into Foundation
                </Button>
                <Button
                  type="button"
                  variant="prominent"
                  onClick={showAddForm ? closeAddForm : openAddForm}
                  className="min-h-10"
                >
                  {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {showAddForm ? "Close" : "Add Donation"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </GlassCard>

      {/* Compact mobile totals */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <GlassCard className="p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">F&amp;D</p>
          </div>
          <p className="mt-1 text-base font-bold tabular-nums">{compactCurrency(data.totals.frankDeenie)}</p>
        </GlassCard>
        <GlassCard className="p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kids</p>
          </div>
          <p className="mt-1 text-base font-bold tabular-nums">{includeChildren ? compactCurrency(data.totals.children) : "—"}</p>
        </GlassCard>
        <GlassCard className="p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
          </div>
          <p className="mt-1 text-base font-bold tabular-nums">{compactCurrency(visibleTotal)}</p>
        </GlassCard>
      </div>

      {/* Mobile-only chart: shown above the donation list */}
      <GlassCard className="sm:hidden">
        <div className="mb-2 flex items-center justify-between">
          <CardLabel>Year Split</CardLabel>
          <p className="text-[10px] font-medium text-muted-foreground">
            {filters.search.trim() || "All orgs"}
          </p>
        </div>
        <FrankDeenieYearSplitChart data={yearSplitChartData} onYearClick={handleYearClick} yearFormatter={chartYearFormatter} />
      </GlassCard>

      {data.foundationEvents.length > 0 ? (
        <GlassCard className="sm:hidden">
          <CardLabel>Foundation Events</CardLabel>
          {(["fund_foundation", "transfer_to_foundation"] as const).map((type) => {
            const events = data.foundationEvents.filter((e) => e.eventType === type);
            if (events.length === 0) return null;
            return (
              <div key={type} className="mt-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  {type === "fund_foundation" ? (
                    <Landmark className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Banknote className="h-3 w-3 text-muted-foreground" />
                  )}
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {type === "fund_foundation" ? "Fund Foundation" : "Transfer into Foundation"}
                  </p>
                </div>
                <ul className="space-y-0.5">
                  {events.map((evt) => (
                    <li key={evt.id} className="group flex items-center justify-between rounded-lg px-1.5 py-1 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{tableDate(evt.eventDate)}</span>
                          <span className="text-sm font-semibold tabular-nums">{currency(evt.amount)}</span>
                        </div>
                        {evt.memo ? (
                          <p className="truncate text-xs text-muted-foreground">{evt.memo}</p>
                        ) : null}
                      </div>
                      {!readOnly ? (
                        <div className="ml-2 flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setEditingFoundationEvent(evt)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            aria-label="Edit event"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFoundationEvent(evt.id)}
                            disabled={deletingEventId === evt.id}
                            className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                            aria-label="Delete event"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </GlassCard>
      ) : null}

      <PageWithSidebar
        variant="narrow-sidebar"
        breakpoint="2xl"
        collapsible={false}
        className="2xl:items-start"
        sidebar={
          <div className="grid gap-3">
            {/* Sidebar chart: desktop only (mobile chart is above the grid) */}
            <GlassCard className="hidden sm:block">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardLabel>Year Split for Filtered View</CardLabel>
                  <p className="text-xs text-muted-foreground">
                    Selected period: {selectedYear === null ? "All years" : selectedYearLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Organization filter: {filters.search.trim() || "All"}
                  </p>
                </div>
              </div>
              <FrankDeenieYearSplitChart data={yearSplitChartData} onYearClick={handleYearClick} yearFormatter={chartYearFormatter} />
            </GlassCard>

            <section className="hidden sm:grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
              <MetricCard
                title="FRANK &amp; DEENIE"
                value={currency(data.totals.frankDeenie)}
                icon={DollarSign}
                tone="emerald"
                className="transition-all hover:shadow-md hover:border-border/80"
              />
              <MetricCard
                title="CHILDREN"
                value={includeChildren ? currency(data.totals.children) : "Not included"}
                icon={Users}
                tone="indigo"
                className="transition-all hover:shadow-md hover:border-border/80"
              />
              <MetricCard 
                title="VISIBLE TOTAL" 
                value={currency(visibleTotal)} 
                icon={PieChart} 
                tone="amber" 
                className="transition-all hover:shadow-md hover:border-border/80"
              />
            </section>

            {data.foundationEvents.length > 0 ? (
              <GlassCard className="hidden sm:block">
                <CardLabel>Foundation Events</CardLabel>
                {(["fund_foundation", "transfer_to_foundation"] as const).map((type) => {
                  const events = data.foundationEvents.filter((e) => e.eventType === type);
                  if (events.length === 0) return null;
                  return (
                    <div key={type} className="mt-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {type === "fund_foundation" ? (
                          <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {type === "fund_foundation" ? "Fund Foundation" : "Transfer into Foundation"}
                        </p>
                      </div>
                      <ul className="space-y-1">
                        {events.map((evt) => (
                          <li key={evt.id} className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{tableDate(evt.eventDate)}</span>
                                <span className="font-semibold tabular-nums">{currency(evt.amount)}</span>
                              </div>
                              {evt.memo ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{evt.memo}</p>
                              ) : null}
                            </div>
                            {!readOnly ? (
                              <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => setEditingFoundationEvent(evt)}
                                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                                  aria-label="Edit event"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteFoundationEvent(evt.id)}
                                  disabled={deletingEventId === evt.id}
                                  className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                                  aria-label="Delete event"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </GlassCard>
            ) : null}

            {SHOW_FRANK_DEENIE_IMPORT && profile.role === "oversight" ? (
              <GlassCard>
                {/* Mobile: collapsible toggle */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between sm:hidden"
                  onClick={() => setImportExpanded((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <CardLabel>Import CSV</CardLabel>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${importExpanded ? "rotate-180" : ""}`} />
                </button>
                {/* Desktop: always-visible label */}
                <div className="hidden sm:block">
                  <CardLabel>Import Frank &amp; Deenie CSV</CardLabel>
                </div>
                <div className={`${importExpanded ? "block" : "hidden"} sm:block`}>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Required headers:{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      date,name,amount
                    </code>
                    . Optional: memo, status.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status values are limited to <strong>Gave</strong> or <strong>Planned</strong>.
                  </p>
                  <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={importCsv}>
                    <input
                      key={importInputKey}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => setImportCsvFile(event.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
                    />
                    <Button
                      size="lg"
                      type="submit"
                      disabled={importingCsv}
                      className="w-full sm:w-auto"
                    >
                      {importingCsv ? "Importing..." : "Import CSV"}
                    </Button>
                  </form>
                </div>
              </GlassCard>
            ) : null}
          </div>
        }
      >
        <GlassCard className="min-h-0 overflow-hidden">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <CardLabel>Donations</CardLabel>
              <p className="text-xs text-muted-foreground">
                Showing {formatNumber(filteredRows.length)} rows | Total {currency(visibleTotal)}
              </p>
            </div>
            <DropdownMenu open={isExportMenuOpen} onOpenChange={setIsExportMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 transition-colors hover:bg-muted">
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExportMenuOpen ? "rotate-180" : ""}`} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 animate-in fade-in-0 zoom-in-95">
                <DropdownMenuItem className="text-xs font-semibold transition-colors hover:bg-muted" onSelect={exportPdf}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs font-semibold transition-colors hover:bg-muted" onSelect={exportCsv}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs font-semibold transition-colors hover:bg-muted" onSelect={exportExcel}>
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs font-semibold transition-colors hover:bg-muted" onSelect={() => { void exportGoogleSheet(); }}>
                  Export to Google Sheet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile filters: inline search + segmented status + sort pills */}
          <div className="mb-3 space-y-2.5 sm:hidden">
            <div
              className="relative flex rounded-lg border border-input shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-[hsl(var(--accent)/0.45)] focus-within:shadow-[0_0_0_2px_hsl(var(--accent)/0.22)]"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsFilterNameOpen(false);
                }
              }}
            >
              <input
                ref={filterNameInputRef}
                value={filters.search}
                onChange={(event) => {
                  setFilter("search", event.target.value);
                  setIsFilterNameOpen(true);
                }}
                onFocus={() => setIsFilterNameOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" || event.key === "Enter" || event.key === "Tab") {
                    setIsFilterNameOpen(false);
                    if (event.key === "Enter") {
                      event.preventDefault();
                      filterNameInputRef.current?.blur();
                    }
                  }
                }}
                autoComplete="off"
                placeholder="Search organizations..."
                className="min-w-0 flex-1 rounded-l-lg border-none bg-transparent px-3 py-2.5 text-sm text-foreground shadow-none outline-none"
              />
              {filters.search ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setFilter("search", "");
                    setIsFilterNameOpen(false);
                    filterNameInputRef.current?.focus();
                  }}
                  className="flex w-9 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              ) : null}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsFilterNameOpen((open) => !open)}
                className="flex w-10 shrink-0 items-center justify-center rounded-r-lg border-l border-input bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Toggle name suggestions"
                aria-expanded={showFilterNamePanel}
              >
                <ChevronDown aria-hidden="true" size={16} />
              </button>
              {showFilterNamePanel ? (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
                >
                  {normalizedFilterSearch ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setIsFilterNameOpen(false)}
                      className="mb-1 block w-full rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                    >
                      Show all organizations matching &ldquo;{filters.search.trim()}&rdquo;
                    </button>
                  ) : null}
                  {filterNameSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setFilter("search", name);
                        setIsFilterNameOpen(false);
                      }}
                      className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted ${
                        filters.search.trim().toLowerCase() === name.trim().toLowerCase()
                          ? "bg-muted font-semibold text-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  {normalizedFilterSearch.length > 0 && filterNameSuggestions.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                      No matching organizations
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "Gave", "Planned"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter("status", status === "all" ? "all" : status)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    filters.status === (status === "all" ? "all" : status)
                      ? "bg-foreground text-card"
                      : "bg-muted/80 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {status === "all" ? "All" : status}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" />
              {([["date", "Date"], ["name", "Name"], ["amount", "$"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSort(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortKey === key
                      ? "bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))] font-semibold"
                      : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {label}
                  {sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop filters */}
          <FilterPanel className="mb-3 hidden gap-2 items-end sm:grid sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_auto]">
            <div className="text-xs font-semibold text-muted-foreground">
              Organization
              <div
                className="relative mt-1 flex rounded-md border border-input shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-[hsl(var(--accent)/0.45)] focus-within:shadow-[0_0_0_2px_hsl(var(--accent)/0.22)]"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsFilterNameOpen(false);
                  }
                }}
              >
                <input
                  value={filters.search}
                  onChange={(event) => {
                    setFilter("search", event.target.value);
                    setIsFilterNameOpen(true);
                  }}
                  onFocus={() => setIsFilterNameOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" || event.key === "Enter" || event.key === "Tab") {
                      setIsFilterNameOpen(false);
                      if (event.key === "Enter") {
                        event.preventDefault();
                        (event.target as HTMLInputElement).blur();
                      }
                    }
                  }}
                  autoComplete="off"
                  placeholder="Search by name"
                  className="min-w-0 flex-1 rounded-l-md border-none bg-transparent px-2 py-2 text-sm text-foreground shadow-none outline-none normal-case h-10"
                />
                {filters.search ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setFilter("search", "");
                      setIsFilterNameOpen(false);
                    }}
                    className="flex w-8 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setIsFilterNameOpen((open) => !open)}
                  className="flex w-10 shrink-0 items-center justify-center rounded-r-md border-l border-input bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                  aria-label="Toggle name suggestions"
                  aria-expanded={showFilterNamePanel}
                >
                  <ChevronDown aria-hidden="true" size={16} />
                </button>
                {showFilterNamePanel ? (
                  <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
                  >
                    {normalizedFilterSearch ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setIsFilterNameOpen(false)}
                        className="mb-1 block w-full rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                      >
                        Show all organizations matching &ldquo;{filters.search.trim()}&rdquo;
                      </button>
                    ) : null}
                    {filterNameSuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setFilter("search", name);
                          setIsFilterNameOpen(false);
                        }}
                        className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted ${
                          filters.search.trim().toLowerCase() === name.trim().toLowerCase()
                            ? "bg-muted font-semibold text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                    {normalizedFilterSearch.length > 0 && filterNameSuggestions.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-muted-foreground">
                        No matching organizations
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <label className="text-xs font-semibold text-muted-foreground">
              Status
              <select
                value={filters.status}
                onChange={(event) => setFilter("status", event.target.value)}
                className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 w-full rounded-md border px-3 py-2 text-base outline-none md:text-sm mt-1 normal-case"
              >
                <option value="all">All</option>
                {DONATION_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col justify-end pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setIsExportMenuOpen(false);
                  setIsFilterNameOpen(false);
                }}
                className="w-full xl:w-auto h-10"
              >
                Clear filters
              </Button>
            </div>
          </FilterPanel>

          {filters.search.trim() ? (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={includedFilterNames.length === 0}
                  onClick={() => {
                    setGivingHistoryName(filters.search.trim());
                    setGivingHistoryFuzzy(includedFilterNames.length !== 1);
                    setGivingHistoryNames(includedFilterNames);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <History className="h-3.5 w-3.5" />
                  Giving history for &ldquo;{filters.search.trim()}&rdquo;
                </button>
              </div>
              {filteredOrgNames.length >= 2 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {filteredOrgNames.map((orgName) => (
                    <label key={orgName} className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={!excludedFilterNames.has(orgName)}
                        onChange={() => {
                          setExcludedFilterNames((prev) => {
                            const next = new Set(prev);
                            if (next.has(orgName)) next.delete(orgName);
                            else next.add(orgName);
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--accent))]"
                      />
                      {orgName}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="divide-y divide-border/60 md:hidden">
            {filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-muted/20 p-8 text-center">
                <div className="mb-4 rounded-full border border-border bg-muted p-3">
                  <DollarSign className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">No donations found</h3>
                <p className="mb-4 text-xs text-muted-foreground max-w-sm">
                  No donations match the selected filters for {selectedYearLabel}.
                  Try adjusting your filters or add a new donation to get started.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              mobileRows.map((row) => {
                const notesText = row.memo.trim();
                const isChildren = row.source === "children";
                const isReturnedOriginal = row.returnRole === "original";
                const isReversal = row.returnRole === "reversal";
                const isReplacement = row.returnRole === "replacement";

                return (
                  <article
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailRowId(row.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailRowId(row.id); } }}
                    className={`relative cursor-pointer px-1 py-3.5 transition-all active:scale-[0.985] ${
                      isChildren && !isReturnedOriginal ? "pl-3.5" : ""
                    } ${isReturnedOriginal ? "opacity-60" : ""} ${isReversal ? "opacity-60" : ""}`}
                  >
                    {isChildren && !isReturnedOriginal ? (
                      <span className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-full bg-amber-400 dark:bg-amber-500" />
                    ) : null}
                    {isReturnedOriginal ? (
                      <span className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-full bg-rose-400 dark:bg-rose-500" />
                    ) : null}
                    {isReversal ? (
                      <span className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-full bg-rose-400 dark:bg-rose-500" />
                    ) : null}
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={`text-lg font-bold tabular-nums ${isReturnedOriginal ? "line-through text-muted-foreground" : isReversal ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                        {isReversal ? "-" : ""}${formatNumber(Math.abs(row.amount), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isReturnedOriginal ? (
                          <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300">
                            Returned
                          </span>
                        ) : isReversal ? (
                          <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300">
                            Reversal
                          </span>
                        ) : isReplacement ? (
                          <span className="inline-flex rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300">
                            Reissued
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            row.status === "Planned"
                              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                              : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                    <p className={`mt-1 text-sm font-semibold leading-snug ${isReturnedOriginal ? "line-through text-muted-foreground" : "text-foreground/90"}`} title={row.name}>
                      {row.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tableDate(row.date)}
                      <span className="mx-1.5">&middot;</span>
                      {isChildren ? "Children" : byDisplay(row)}
                      {notesText ? <><span className="mx-1.5">&middot;</span><span className="text-muted-foreground/70">{notesText}</span></> : null}
                    </p>
                  </article>
                );
              })
            )}
          </div>

          {hasMoreMobileRows ? (
            <div className="flex flex-col items-center gap-2 py-4 md:hidden">
              <p className="text-xs text-muted-foreground">
                Showing {mobileVisibleCount} of {filteredRows.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setMobileVisibleCount((c) => c + MOBILE_PAGE_SIZE)}>
                  Show {Math.min(MOBILE_PAGE_SIZE, filteredRows.length - mobileVisibleCount)} more
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMobileVisibleCount(filteredRows.length)}>
                  Show all
                </Button>
              </div>
            </div>
          ) : null}

          {/* Desktop table */}
          <div
            className="hidden max-h-[62vh] overflow-auto rounded-xl border border-border md:block"
            onClick={() => {
              setIsExportMenuOpen(false);
            }}
          >
            <table className="w-full table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[32%]" />
                <col className="w-[24%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[5%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-card">
                <DataTableHeadRow>
                  <th className="px-2 py-2">
                    <DataTableSortButton onClick={() => toggleSort("date")}>
                      Sent Date{sortMarker("date")}
                    </DataTableSortButton>
                  </th>
                  <th className="px-2 py-2">
                    <DataTableSortButton onClick={() => toggleSort("name")}>
                      Name{sortMarker("name")}
                    </DataTableSortButton>
                  </th>
                  <th className="px-2 py-2">
                    <DataTableSortButton onClick={() => toggleSort("memo")}>
                      Notes{sortMarker("memo")}
                    </DataTableSortButton>
                  </th>
                  <th className="px-2 py-2 text-right">
                    <DataTableSortButton onClick={() => toggleSort("amount")}>
                      Amount ($){sortMarker("amount")}
                    </DataTableSortButton>
                  </th>
                  <th className="px-2 py-2">
                    <DataTableSortButton onClick={() => toggleSort("status")}>
                      Status{sortMarker("status")}
                    </DataTableSortButton>
                  </th>
                  <th className="px-2 py-2">By</th>
                  <th className="px-2 py-2" />
                </DataTableHeadRow>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-center" colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-2">
                        <div className="mb-2 rounded-full border border-border bg-muted p-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <h3 className="mb-1 text-xs font-semibold text-foreground">No donations found</h3>
                        <p className="mb-2 text-xs text-muted-foreground">
                          No donations match the selected filters for {selectedYearLabel}.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFilters(DEFAULT_FILTERS)}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isReturnedOriginal = row.returnRole === "original";
                    const isReversal = row.returnRole === "reversal";
                    const isReplacement = row.returnRole === "replacement";

                    return (
                        <DataTableRow
                          key={row.id}
                          className={`group cursor-pointer align-middle transition-colors hover:bg-muted/30 ${
                            row.source === "children" && !isReturnedOriginal ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                          } ${isReturnedOriginal || isReversal ? "opacity-60" : ""}`}
                          onClick={(event) => {
                            const target = event.target;
                            if (
                              target instanceof HTMLElement &&
                              target.closest("a,button,input,select,textarea,[role='button'],[data-row-open-ignore='true']")
                            ) {
                              return;
                            }

                            setDetailRowId(row.id);
                          }}
                        >
                          <td className="whitespace-nowrap px-2 py-2 text-muted-foreground align-middle">{tableDate(row.date)}</td>
                          <td className="px-2 py-2 align-middle">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p
                                className={`truncate text-left font-semibold transition-colors group-hover:text-primary group-hover:underline ${isReturnedOriginal ? "line-through text-muted-foreground" : ""}`}
                                title={row.name}
                              >
                                {row.name}
                              </p>
                              {row.source === "children" && !isReturnedOriginal ? (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                  <Users className="h-2.5 w-2.5" />
                                  Children
                                </span>
                              ) : null}
                              {isReturnedOriginal ? (
                                <span className="shrink-0 inline-flex rounded-full border border-rose-300 bg-rose-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300">
                                  Returned
                                </span>
                              ) : isReversal ? (
                                <span className="shrink-0 inline-flex rounded-full border border-rose-300 bg-rose-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300">
                                  Reversal
                                </span>
                              ) : isReplacement ? (
                                <span className="shrink-0 inline-flex rounded-full border border-blue-300 bg-blue-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300">
                                  Reissued
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2 align-middle">
                            <p className="truncate text-muted-foreground" title={row.memo.trim() || undefined}>
                              {row.memo.trim() || "—"}
                            </p>
                          </td>
                          <td className={`px-2 py-2 text-right tabular-nums align-middle font-medium ${isReturnedOriginal ? "line-through text-muted-foreground" : isReversal ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                            {isReversal ? "-" : ""}{formatNumber(Math.abs(row.amount), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-2 align-middle">
                            <span
                              className={`inline-flex justify-center rounded-full border px-2 py-px text-[11px] font-semibold transition-colors ${
                                row.status === "Planned"
                                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground align-middle">{byDisplay(row)}</td>
                          <td className="px-2 py-2 align-middle">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={(event) => event.stopPropagation()}
                                    aria-label="Open actions"
                                    className="transition-colors hover:bg-muted"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36 animate-in fade-in-0 zoom-in-95">
                                  <DropdownMenuItem
                                    className="text-xs font-semibold transition-colors hover:bg-muted"
                                    onSelect={() => setDetailRowId(row.id)}
                                  >
                                    View details
                                  </DropdownMenuItem>
                                  {!readOnly && row.editable ? (
                                    <DropdownMenuItem
                                      className="text-xs font-semibold transition-colors hover:bg-muted"
                                      onSelect={() => {
                                        setDetailMode("edit");
                                        setDetailRowId(row.id);
                                      }}
                                    >
                                      Edit
                                    </DropdownMenuItem>
                                  ) : null}
                                  {!readOnly && isAdmin && !row.editable ? (
                                    <DropdownMenuItem
                                      className="text-xs font-semibold transition-colors hover:bg-muted"
                                      onSelect={() => {
                                        setDetailMode("edit-notes");
                                        setDetailRowId(row.id);
                                      }}
                                    >
                                      Edit notes
                                    </DropdownMenuItem>
                                  ) : null}
                                  {!readOnly && row.editable && !row.returnRole ? (
                                    <DropdownMenuItem
                                      className="text-xs font-semibold text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors"
                                      onSelect={() => requestDelete(row)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </DataTableRow>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

      </PageWithSidebar>

      <DonationDetailDrawer
        row={detailRow}
        isAdmin={isAdmin}
        readOnly={readOnly}
        deletingRowId={deletingRowId}
        initialMode={detailMode}
        onClose={closeDetailDrawer}
        onMutate={handleDetailMutate}
        onBeginReturn={handleDetailBeginReturn}
        onRequestDelete={handleDetailRequestDelete}
        onViewHistory={handleDetailViewHistory}
      />

      {!readOnly ? (
        <AddDonationForm
          open={showAddForm}
          onClose={closeAddForm}
          selectedYear={selectedYear}
          nameSuggestions={allNameSuggestions}
          onCreated={handleDonationCreated}
        />
      ) : null}

      <ResponsiveModal
        open={!!givingHistoryName}
        onOpenChange={(open) => { if (!open) { setGivingHistoryName(null); setGivingHistoryFuzzy(false); setGivingHistoryNames(null); } }}
      >
        {givingHistoryName ? (
          <ResponsiveModalContent
            aria-labelledby="giving-history-title"
            dialogClassName="rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl"
            showCloseButton={false}
          >
            <CharityGivingHistory
              charityName={givingHistoryName}
              fuzzy={givingHistoryFuzzy}
              names={givingHistoryNames ?? undefined}
              onBack={() => { setGivingHistoryName(null); setGivingHistoryFuzzy(false); setGivingHistoryNames(null); }}
            />
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>

      <ResponsiveModal
        open={chartDrilldownYear !== null}
        onOpenChange={(open) => { if (!open) setChartDrilldownYear(null); }}
      >
        <ResponsiveModalContent
          aria-labelledby="chart-drilldown-title"
          dialogClassName="rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-lg"
          showCloseButton={false}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 id="chart-drilldown-title" className="text-base font-bold text-foreground">
                {chartDrilldownYear !== null ? yearLabel(chartDrilldownYear, yearMode) : ""} Donations
              </h3>
              <button
                type="button"
                onClick={() => setChartDrilldownYear(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(chartDrilldownRows.length)} donation{chartDrilldownRows.length !== 1 ? "s" : ""} &middot; {currency(chartDrilldownRows.reduce((s, r) => s + r.amount, 0))} total
            </p>
            {chartDrilldownRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No donations for this year.</p>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {([["date", "Date", ""], ["name", "Name", ""], ["amount", "Amount", " text-right"], ["status", "Status", ""]] as const).map(([key, label, extra]) => (
                        <th
                          key={key}
                          className={`cursor-pointer select-none px-2 py-1.5 hover:text-foreground transition-colors${extra}`}
                          onClick={() => {
                            if (drilldownSortKey === key) {
                              setDrilldownSortDir((d) => d === "asc" ? "desc" : "asc");
                            } else {
                              setDrilldownSortKey(key);
                              setDrilldownSortDir(key === "date" ? "desc" : "asc");
                            }
                          }}
                        >
                          {label}{drilldownSortKey === key ? (drilldownSortDir === "asc" ? " ^" : " v") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {chartDrilldownRows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{tableDate(row.date)}</td>
                        <td className="px-2 py-1.5">{row.name}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{currency(row.amount)}</td>
                        <td className="px-2 py-1.5">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {!readOnly ? (
        <>
          <ResponsiveModal
            open={deleteConfirmRow !== null}
            onOpenChange={(open) => { if (!open) setDeleteConfirmRow(null); }}
          >
            {deleteConfirmRow ? (
              <ResponsiveModalContent
                aria-labelledby="delete-confirm-title"
                dialogClassName="max-w-md rounded-3xl p-5"
                showCloseButton={false}
              >
                <div className="space-y-4">
                  <div>
                    <h2 id="delete-confirm-title" className="text-lg font-bold text-foreground">
                      Delete Donation
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Are you sure you want to delete the donation to{" "}
                      <span className="font-semibold text-foreground">&ldquo;{deleteConfirmRow.name}&rdquo;</span>{" "}
                      on {tableDate(deleteConfirmRow.date)}?
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                      onClick={() => void executeDelete()}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={() => setDeleteConfirmRow(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </ResponsiveModalContent>
            ) : null}
          </ResponsiveModal>

          <ReturnCheckForm
            row={returnRow}
            onClose={handleReturnClose}
            onReturned={handleReturnDone}
          />

          <FoundationEventForm
            eventType={foundationEventType}
            editingEvent={editingFoundationEvent}
            onClose={handleFoundationEventClose}
            onSaved={handleFoundationEventSaved}
          />
        </>
      ) : null}
    </div>
  );
}
