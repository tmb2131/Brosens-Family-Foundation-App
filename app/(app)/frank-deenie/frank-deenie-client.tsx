"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { Calendar, ChevronDown, DollarSign, Download, History, MoreHorizontal, PieChart, Plus, RefreshCw, Users, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

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
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getProposerDisplayName } from "@/lib/proposer-display-names";
import { FrankDeenieDonationRow, FrankDeenieSnapshot } from "@/lib/types";
import { currency, formatNumber, parseNumberInput, toISODate } from "@/lib/utils";

type SortKey = "date" | "name" | "memo" | "amount" | "status";
type SortDirection = "asc" | "desc";

interface DonationDraft {
  date: string;
  type: string;
  name: string;
  memo: string;
  split: string;
  amount: string;
  status: string;
}

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
}

const DEFAULT_FILTERS: DonationFilters = {
  search: "",
  status: "all"
};

const DONATION_STATUSES = ["Gave", "Planned"] as const;
const SHOW_FRANK_DEENIE_IMPORT = true;
const EXPORT_HEADERS = ["Date", "Name", "Notes", "Amount", "Status", "Source", "Proposed by"] as const;

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

function initialDraftForYear(year: number | null): DonationDraft {
  return {
    date: year ? `${year}-01-01` : toISODate(new Date()),
    type: "donation",
    name: "",
    memo: "",
    split: "",
    amount: "",
    status: "Gave"
  };
}

function rowToDraft(row: FrankDeenieDonationRow): DonationDraft {
  return {
    date: row.date,
    type: row.type,
    name: row.name,
    memo: row.memo,
    split: row.split,
    amount: Number.isInteger(row.amount) ? String(row.amount) : row.amount.toFixed(2),
    status: row.status
  };
}

function tableDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    row.proposedBy
  ];
}

function buildCsv(rows: DonationExportRow[]) {
  const headerLine = EXPORT_HEADERS.join(",");
  const dataLines = rows.map((row) => rowToExportValues(row).map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function buildTsv(rows: DonationExportRow[]) {
  const sanitize = (value: string) => value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  const headerLine = EXPORT_HEADERS.join("\t");
  const dataLines = rows.map((row) => rowToExportValues(row).map(sanitize).join("\t"));
  return [headerLine, ...dataLines].join("\n");
}

function buildExcelHtml(rows: DonationExportRow[], title: string, subtitle: string) {
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
      th, td { border: 1px solid #d4d4d8; padding: 6px 8px; font-size: 12px; text-align: left; }
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

function buildPrintableHtml(rows: DonationExportRow[], title: string, subtitle: string) {
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

export default function FrankDeenieClient() {
  const { user } = useAuth();
  const canAccess = user ? ["oversight", "admin", "manager"].includes(user.role) : false;

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [filters, setFilters] = useState<DonationFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDraft, setNewDraft] = useState<DonationDraft>(() => initialDraftForYear(null));
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DonationDraft, string>>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [importCsvFile, setImportCsvFile] = useState<File | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importInputKey, setImportInputKey] = useState(0);
  const [importMessage, setImportMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [exportMessage, setExportMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DonationDraft | null>(null);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [openActionMenuRowId, setOpenActionMenuRowId] = useState<string | null>(null);
  const [rowMessageById, setRowMessageById] = useState<
    Record<string, { tone: "success" | "error"; text: string }>
  >({});
  const [isNameSuggestionsOpen, setIsNameSuggestionsOpen] = useState(false);
  const [isFilterNameOpen, setIsFilterNameOpen] = useState(false);
  const [givingHistoryName, setGivingHistoryName] = useState<string | null>(null);
  const addDonationNameInputRef = useRef<HTMLInputElement | null>(null);
  const addDonationDateInputRef = useRef<HTMLInputElement | null>(null);
  const editDonationDateInputRef = useRef<HTMLInputElement | null>(null);
  const filterNameInputRef = useRef<HTMLInputElement | null>(null);

  const nameSuggestionsQuery = useSWR<{ names: string[] }>(
    canAccess ? "/api/frank-deenie/name-suggestions" : null
  );
  const allNameSuggestions = useMemo(
    () => nameSuggestionsQuery.data?.names ?? [],
    [nameSuggestionsQuery.data]
  );
  const normalizedDraftName = useMemo(() => newDraft.name.trim().toLowerCase(), [newDraft.name]);
  const matchingNameSuggestions = useMemo(() => {
    if (!allNameSuggestions.length) return [];
    if (!normalizedDraftName) return allNameSuggestions.slice(0, 12);

    const startsWithMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const suggestion of allNameSuggestions) {
      const normalized = suggestion.trim().toLowerCase();
      if (!normalized.includes(normalizedDraftName)) continue;
      if (normalized.startsWith(normalizedDraftName)) {
        startsWithMatches.push(suggestion);
      } else {
        containsMatches.push(suggestion);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 12);
  }, [allNameSuggestions, normalizedDraftName]);
  const showNameSuggestionsPanel =
    isNameSuggestionsOpen && (matchingNameSuggestions.length > 0 || normalizedDraftName.length > 0);
  const showCreateNameOption =
    normalizedDraftName.length > 0 &&
    !allNameSuggestions.some((s) => s.trim().toLowerCase() === normalizedDraftName);

  const normalizedFilterSearch = useMemo(() => filters.search.trim().toLowerCase(), [filters.search]);
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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("includeChildren", includeChildren ? "1" : "0");
    if (selectedYear !== null) {
      params.set("year", String(selectedYear));
    }
    return params.toString();
  }, [includeChildren, selectedYear]);

  const { data, error, isLoading, mutate } = useSWR<FrankDeenieSnapshot>(
    canAccess ? `/api/frank-deenie?${queryString}` : null,
    { refreshInterval: 120_000 }
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    if (selectedYear !== null && !data.availableYears.includes(selectedYear)) {
      setSelectedYear(null);
    }
  }, [data, selectedYear]);

  useEffect(() => {
    if (!editingId || !data) {
      return;
    }

    const stillExists = data.rows.some((row) => row.id === editingId);
    if (!stillExists) {
      setEditingId(null);
      setEditDraft(null);
    }
  }, [data, editingId]);

  useEffect(() => {
    if (!detailRowId) {
      return;
    }

    const rowStillExists = data?.rows.some((row) => row.id === detailRowId) ?? false;
    if (!rowStillExists) {
      setDetailRowId(null);
      setOpenActionMenuRowId(null);
    }
  }, [data, detailRowId]);

  useEffect(() => {
    const hasOpenOverlay = showAddForm || detailRowId !== null;
    if (!hasOpenOverlay) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = showAddForm
      ? window.requestAnimationFrame(() => {
          addDonationNameInputRef.current?.focus();
        })
      : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (showAddForm && !isCreating) {
        setShowAddForm(false);
        setCreateMessage(null);
        return;
      }

      if (detailRowId !== null) {
        if (editingId === detailRowId) {
          setEditingId(null);
          setEditDraft(null);
        }
        setDetailRowId(null);
        setOpenActionMenuRowId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailRowId, editingId, isCreating, showAddForm]);


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
  }, [data, filters, sortDirection, sortKey]);
  const detailRow = useMemo(() => {
    if (!data || !detailRowId) {
      return null;
    }

    return data.rows.find((row) => row.id === detailRowId) ?? null;
  }, [data, detailRowId]);

  const visibleTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.amount, 0),
    [filteredRows]
  );
  const selectedYearLabel = selectedYear === null ? "all years" : String(selectedYear);
  const exportRows = useMemo<DonationExportRow[]>(
    () =>
      filteredRows.map((row) => ({
        date: row.date,
        name: row.name.trim(),
        memo: row.memo.trim(),
        amount: row.amount,
        status: row.status.trim(),
        source: row.source === "children" ? "Children" : "Frank & Deenie",
        proposedBy: byDisplay(row)
      })),
    [filteredRows]
  );
  const exportFilenameBase = useMemo(() => {
    const yearPart = selectedYear === null ? "all-years" : `year-${selectedYear}`;
    const childrenPart = includeChildren ? "with-children" : "frank-deenie-only";
    return `frank-deenie-${yearPart}-${childrenPart}-${toISODate(new Date())}`;
  }, [includeChildren, selectedYear]);
  const exportTitle = "Frank & Deenie Donation Ledger";
  const exportSubtitle = `${
    selectedYear === null ? "All years" : `Year ${selectedYear}`
  } | ${includeChildren ? "Includes Children" : "Frank & Deenie only"} | ${formatNumber(exportRows.length)} rows`;
  const yearSplitChartData = useMemo(() => {
    if (!data) {
      return [];
    }

    const totals = {
      Gave: {
        frankDeenie: 0,
        children: 0
      },
      Planned: {
        frankDeenie: 0,
        children: 0
      }
    };

    for (const row of data.rows) {
      const normalizedStatus = row.status.trim().toLowerCase();
      const statusBucket = normalizedStatus === "planned" ? "Planned" : "Gave";
      const sourceBucket = row.source === "children" ? "children" : "frankDeenie";
      totals[statusBucket][sourceBucket] += row.amount;
    }

    return (["Gave", "Planned"] as const).map((status) => ({
      status,
      frankDeenie: totals[status].frankDeenie,
      children: totals[status].children
    }));
  }, [data]);

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

  const openAddForm = () => {
    setShowAddForm(true);
    setCreateMessage(null);
    setFormErrors({});
    setNewDraft(initialDraftForYear(selectedYear));
    setIsNameSuggestionsOpen(false);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setCreateMessage(null);
    setFormErrors({});
    setIsNameSuggestionsOpen(false);
  };

  const closeDetailDrawer = () => {
    if (detailRowId !== null && editingId === detailRowId) {
      setEditingId(null);
      setEditDraft(null);
    }
    setDetailRowId(null);
    setOpenActionMenuRowId(null);
  };

  const clearRowMessage = (rowId: string) => {
    setRowMessageById((current) => {
      if (!current[rowId]) {
        return current;
      }
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

  const beginEdit = (row: FrankDeenieDonationRow) => {
    if (!row.editable) {
      return;
    }

    setEditingId(row.id);
    setEditDraft(rowToDraft(row));
    clearRowMessage(row.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft) {
      return;
    }

    const parsedAmount = parseNumberInput(editDraft.amount);
    if (parsedAmount === null || parsedAmount < 0) {
      setRowMessageById((current) => ({
        ...current,
        [editingId]: {
          tone: "error",
          text: "Amount must be a non-negative number."
        }
      }));
      return;
    }

    setSavingRowId(editingId);
    clearRowMessage(editingId);

    try {
      const response = await fetch(`/api/frank-deenie/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: editDraft.date,
          type: editDraft.type,
          name: editDraft.name,
          memo: editDraft.memo,
          split: editDraft.split,
          amount: parsedAmount,
          status: editDraft.status
        })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to update donation."));
      }

      setRowMessageById((current) => ({
        ...current,
        [editingId]: {
          tone: "success",
          text: "Donation updated."
        }
      }));
      setEditingId(null);
      setEditDraft(null);
      void mutate();
    } catch (saveError) {
      setRowMessageById((current) => ({
        ...current,
        [editingId]: {
          tone: "error",
          text: saveError instanceof Error ? saveError.message : "Failed to update donation."
        }
      }));
    } finally {
      setSavingRowId(null);
    }
  };

  const deleteRow = async (row: FrankDeenieDonationRow) => {
    if (!row.editable) {
      return;
    }

    const confirmed = window.confirm(`Delete donation to "${row.name}" on ${tableDate(row.date)}?`);
    if (!confirmed) {
      return;
    }

    setDeletingRowId(row.id);
    clearRowMessage(row.id);

    try {
      const response = await fetch(`/api/frank-deenie/${row.id}`, {
        method: "DELETE"
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to delete donation."));
      }

      if (editingId === row.id) {
        setEditingId(null);
        setEditDraft(null);
      }
      void mutate();
    } catch (deleteError) {
      setRowMessageById((current) => ({
        ...current,
        [row.id]: {
          tone: "error",
          text: deleteError instanceof Error ? deleteError.message : "Failed to delete donation."
        }
      }));
    } finally {
      setDeletingRowId(null);
    }
  };

  const validateForm = (draft: DonationDraft): Partial<Record<keyof DonationDraft, string>> => {
    const errors: Partial<Record<keyof DonationDraft, string>> = {};
    
    if (!draft.name.trim()) {
      errors.name = "Name is required";
    }
    
    const parsedAmount = parseNumberInput(draft.amount);
    if (parsedAmount === null || parsedAmount < 0) {
      errors.amount = "Amount must be a non-negative number";
    }
    
    if (!draft.date) {
      errors.date = "Date is required";
    }
    
    return errors;
  };

  const updateDraft = (field: keyof DonationDraft, value: string) => {
    setNewDraft(current => {
      const updated = { ...current, [field]: value };
      const errors = validateForm(updated);
      setFormErrors(errors);
      return updated;
    });
  };
  const submitNewDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateMessage(null);

    const errors = validateForm(newDraft);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setCreateMessage({
        tone: "error",
        text: "Please fix the errors below."
      });
      return;
    }

    const parsedAmount = parseNumberInput(newDraft.amount);
    if (parsedAmount === null || parsedAmount < 0) {
      setCreateMessage({
        tone: "error",
        text: "Amount must be a non-negative number."
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/frank-deenie", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: newDraft.date,
          type: newDraft.type,
          name: newDraft.name,
          memo: newDraft.memo,
          split: newDraft.split,
          amount: parsedAmount,
          status: newDraft.status
        })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to create donation."));
      }

      setCreateMessage({
        tone: "success",
        text: "Donation added."
      });
      setNewDraft(initialDraftForYear(selectedYear));
      setFormErrors({});
      void mutate();
    } catch (createError) {
      setCreateMessage({
        tone: "error",
        text: createError instanceof Error ? createError.message : "Failed to create donation."
      });
    } finally {
      setIsCreating(false);
    }
  };

  const importCsv = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importCsvFile) {
      setImportMessage({
        tone: "error",
        text: "Select a CSV file before importing."
      });
      return;
    }

    setImportingCsv(true);
    setImportMessage(null);

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

      setImportMessage({
        tone: "success",
        text: `Imported ${formatNumber(importedCount)} donations${
          skippedCount > 0 ? `, skipped ${formatNumber(skippedCount)} duplicates` : ""
        }.`
      });
      setImportCsvFile(null);
      setImportInputKey((current) => current + 1);
      void mutate();
    } catch (importError) {
      setImportMessage({
        tone: "error",
        text: importError instanceof Error ? importError.message : "Failed to import donations CSV."
      });
    } finally {
      setImportingCsv(false);
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
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      setExportMessage({
        tone: "error",
        text: "The PDF export window was blocked. Allow pop-ups and try again."
      });
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

  if (!user) {
    return <p className="text-sm text-muted-foreground">Loading Frank &amp; Deenie donations...</p>;
  }

  if (!canAccess) {
    return (
      <GlassCard>
        <CardLabel>Frank &amp; Deenie</CardLabel>
        <p className="mt-2 text-sm text-rose-600">
          This page is available only to Oversight, Admin, and Manager users.
        </p>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <div className="page-stack pb-6">
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
      <GlassCard className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Frank &amp; Deenie</CardLabel>
            <CardValue>Donation Ledger</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Track Frank &amp; Deenie giving, with optional Children donations from this app.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <select
              aria-label="Year"
              className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 rounded-md border px-3 py-2 text-sm outline-none block w-full sm:w-auto"
              value={selectedYear === null ? "all" : String(selectedYear)}
              onChange={(event) =>
                setSelectedYear(event.target.value === "all" ? null : Number(event.target.value))
              }
            >
              <option value="all">All years</option>
              {data.availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:bg-muted/50">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={(event) => setIncludeChildren(event.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--accent))]"
              />
              Include Children
            </label>
            <Button
              type="button"
              variant="prominent"
              onClick={showAddForm ? closeAddForm : openAddForm}
              className="w-full sm:w-auto min-h-10"
            >
              {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showAddForm ? "Close" : "Add Donation"}
            </Button>
          </div>
        </div>
      </GlassCard>

      <section className="grid gap-3 2xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)] 2xl:items-start">
        <GlassCard className="min-h-0">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <CardLabel>Donations</CardLabel>
              <p className="text-xs text-muted-foreground">
                Showing {formatNumber(filteredRows.length)} rows | Total {currency(visibleTotal)}
              </p>
            </div>
            <DropdownMenu open={isExportMenuOpen} onOpenChange={(open) => { setIsExportMenuOpen(open); if (open) setExportMessage(null); }}>
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

          <FilterPanel className="mb-3 grid gap-2 items-end sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_auto]">
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
                  ref={filterNameInputRef}
                  value={filters.search}
                  onChange={(event) => {
                    setFilter("search", event.target.value);
                    setIsFilterNameOpen(true);
                  }}
                  onFocus={() => {
                    setExportMessage(null);
                    setIsFilterNameOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setIsFilterNameOpen(false);
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
                      filterNameInputRef.current?.focus();
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
                        onClick={() => {
                          setFilter("search", "");
                          setIsFilterNameOpen(false);
                        }}
                        className="mb-1 block w-full rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                      >
                        Show all organizations
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
                  setExportMessage(null);
                  setIsExportMenuOpen(false);
                  setIsFilterNameOpen(false);
                }}
                className="w-full xl:w-auto h-10"
              >
                Clear filters
              </Button>
            </div>
          </FilterPanel>

          {exportMessage ? (
            <p
              className={`mb-3 text-xs ${
                exportMessage.tone === "error" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {exportMessage.text}
            </p>
          ) : null}

          {/* Mobile card list */}
          <div className="space-y-3 md:hidden">
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
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setExportMessage(null);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              filteredRows.map((row) => {
                const notesText = row.memo.trim();
                const rowMessage = rowMessageById[row.id];

                return (
                  <article
                    key={row.id}
                    className={`rounded-xl border p-4 transition-all hover:shadow-md hover:border-border/80 ${
                      row.source === "children" ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setDetailRowId(row.id)}
                          className="truncate text-left text-sm font-semibold hover:underline hover:text-primary transition-colors"
                          title={row.name}
                        >
                          {row.name}
                        </button>
                        {row.source === "children" ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 transition-colors">
                            <Users className="h-3 w-3" />
                            Children
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                            row.status === "Planned"
                              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                              : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                          }`}
                        >
                          {row.status}
                        </span>
                        {row.editable ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon-sm" aria-label="Open actions">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                className="text-xs font-semibold"
                                onSelect={() => {
                                  beginEdit(row);
                                  setDetailRowId(row.id);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs font-semibold text-destructive focus:text-destructive"
                                onSelect={() => void deleteRow(row)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
                      ${formatNumber(row.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <p>{tableDate(row.date)}</p>
                      <p>By {byDisplay(row)}</p>
                      {notesText ? <p className="col-span-2 truncate">{notesText}</p> : null}
                    </div>
                    {rowMessage ? (
                      <p className={`mt-2 text-xs ${rowMessage.tone === "error" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}>
                        {rowMessage.text}
                      </p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div
            className="hidden max-h-[62vh] overflow-auto rounded-xl border border-border md:block"
            onClick={() => {
              setOpenActionMenuRowId(null);
              setIsExportMenuOpen(false);
            }}
          >
            <table className="w-full table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[22%]" />
                <col />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
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
                  <th className="px-2 py-2" />
                </DataTableHeadRow>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-center" colSpan={6}>
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
                          onClick={() => {
                            setFilters(DEFAULT_FILTERS);
                            setExportMessage(null);
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const rowMessage = rowMessageById[row.id];

                    return (
                      <Fragment key={row.id}>
                        <DataTableRow
                          className={`group cursor-pointer align-middle transition-colors hover:bg-muted/30 ${
                            row.source === "children" ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                          }`}
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
                          <td className="px-2 py-2 text-muted-foreground align-middle">{tableDate(row.date)}</td>
                          <td className="px-2 py-2 align-middle">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p
                                className="truncate text-left font-semibold transition-colors group-hover:text-primary group-hover:underline"
                                title={row.name}
                              >
                                {row.name}
                              </p>
                              {row.source === "children" ? (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                  <Users className="h-2.5 w-2.5" />
                                  Children
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2 align-middle">
                            <p className="truncate text-muted-foreground" title={row.memo.trim() || undefined}>
                              {row.memo.trim() || "—"}
                            </p>
                          </td>
                          <td className="px-2 py-2 text-right text-muted-foreground tabular-nums align-middle font-medium">
                            {formatNumber(row.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
                          <td className="px-2 py-2 align-middle">
                            <div className="relative flex justify-end">
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenActionMenuRowId((current) => (current === row.id ? null : row.id));
                                }}
                                aria-label="Open actions"
                                className="transition-colors hover:bg-muted"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                              {openActionMenuRowId === row.id ? (
                                <div
                                  className="absolute right-0 top-9 z-30 w-36 rounded-lg border border-border bg-card p-1 shadow-xl animate-in fade-in-0 zoom-in-95"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDetailRowId(row.id);
                                      setOpenActionMenuRowId(null);
                                    }}
                                    className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                                  >
                                    View details
                                  </button>
                                  {row.editable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        beginEdit(row);
                                        setDetailRowId(row.id);
                                        setOpenActionMenuRowId(null);
                                      }}
                                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                                    >
                                      Edit
                                    </button>
                                  ) : null}
                                  {row.editable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuRowId(null);
                                        void deleteRow(row);
                                      }}
                                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </DataTableRow>
                        {rowMessage ? (
                          <tr className="border-b">
                            <td
                              colSpan={6}
                              className={`px-2 py-2 text-xs ${
                                rowMessage.tone === "error"
                                  ? "text-rose-600"
                                  : "text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {rowMessage.text}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <div className="grid gap-3">
          <GlassCard>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardLabel>Year Split</CardLabel>
                <p className="text-xs text-muted-foreground">
                  Selected period: {selectedYear === null ? "All years" : selectedYearLabel}
                </p>
              </div>
            </div>
            <FrankDeenieYearSplitChart data={yearSplitChartData} />
          </GlassCard>

          <section className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
            <MetricCard
              title="FRANK &amp; DEENIE"
              value={currency(data.totals.frankDeenie)}
              icon={DollarSign}
              tone="emerald"
              className="transition-all hover:shadow-md hover:border-border/80"
            />
            <MetricCard
              title="CHILDREN"
              value={currency(data.totals.children)}
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

          {SHOW_FRANK_DEENIE_IMPORT && user.role === "oversight" ? (
            <GlassCard>
              <CardLabel>Import Frank &amp; Deenie CSV</CardLabel>
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
                  onChange={(event) => {
                    setImportCsvFile(event.target.files?.[0] ?? null);
                    setImportMessage(null);
                  }}
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
              {importMessage ? (
                <p
                  className={`mt-2 text-xs ${
                    importMessage.tone === "error"
                      ? "text-rose-600"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {importMessage.text}
                </p>
              ) : null}
            </GlassCard>
          ) : null}
        </div>
      </section>

      <Dialog open={!!detailRow} onOpenChange={(open) => { if (!open) closeDetailDrawer(); }}>
        {detailRow ? (
        <DialogContent
          aria-labelledby="donation-details-title"
          className="max-w-3xl rounded-3xl p-4 sm:p-5"
          showCloseButton={false}
        >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="donation-details-title" className="text-lg font-bold">
                  Donation Details
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{detailRow.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      detailRow.source === "children"
                        ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                        : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                    }`}
                  >
                    {detailRow.source === "children" ? "Children" : "Frank & Deenie"}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      detailRow.status === "Planned"
                        ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                    }`}
                  >
                    {detailRow.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGivingHistoryName(detailRow.name)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <History className="h-3 w-3" />
                    Giving history
                  </button>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={closeDetailDrawer}
                aria-label="Close donation details"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {editingId === detailRow.id && editDraft ? (
              <>
                <div className="mt-5 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Edit</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <form className="mt-3 grid gap-3" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Date
                    <button
                      type="button"
                      onClick={() => editDonationDateInputRef.current?.showPicker()}
                      className="mt-1 flex h-9 w-full cursor-pointer items-center rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40"
                    >
                      <span className={`flex-1 text-left ${editDraft.date ? "text-foreground" : "text-muted-foreground"}`}>
                        {editDraft.date ? tableDate(editDraft.date) : "Select date"}
                      </span>
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                    <input
                      ref={editDonationDateInputRef}
                      type="date"
                      value={editDraft.date}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, date: event.target.value } : current))
                      }
                      tabIndex={-1}
                      className="sr-only"
                    />
                  </div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Name
                    <Input
                      type="text"
                      value={editDraft.name}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, name: event.target.value } : current))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Amount
                    <AmountInput
                      min={0}
                      step="0.01"
                      value={editDraft.amount}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, amount: event.target.value } : current))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Status
                    <select
                      value={editDraft.status}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, status: event.target.value } : current))
                      }
                      className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-md border px-3 py-1 text-base outline-none md:text-sm mt-1"
                    >
                      {DONATION_STATUSES.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Notes / Description
                  <Input
                    type="text"
                    value={editDraft.memo}
                    onChange={(event) =>
                      setEditDraft((current) => (current ? { ...current, memo: event.target.value } : current))
                    }
                    className="mt-1"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="prominent"
                    onClick={() => void saveEdit()}
                    disabled={savingRowId === detailRow.id}
                  >
                    {savingRowId === detailRow.id ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={savingRowId === detailRow.id}
                  >
                    Cancel
                  </Button>
                </div>
                </form>
              </>
            ) : (
              <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-muted/60 p-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Date
                  </dt>
                  <dd className="mt-1 font-medium">{tableDate(detailRow.date)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Amount
                  </dt>
                  <dd className="mt-1 text-lg font-bold">{currency(detailRow.amount)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Status
                  </dt>
                  <dd className="mt-1 font-medium">{detailRow.status}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Source
                  </dt>
                  <dd className="mt-1 font-medium">
                    {detailRow.source === "children" ? "Children" : "Frank & Deenie"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Proposed by
                  </dt>
                  <dd className="mt-1 font-medium">{byDisplay(detailRow)}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Notes / Description
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap font-medium">{detailRow.memo || "—"}</dd>
                </div>
              </dl>
            )}

            {rowMessageById[detailRow.id] ? (
              <p
                className={`mt-3 text-xs ${
                  rowMessageById[detailRow.id].tone === "error"
                    ? "text-rose-600"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {rowMessageById[detailRow.id].text}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {detailRow.editable && editingId !== detailRow.id ? (
                <Button
                  variant="outline"
                  onClick={() => beginEdit(detailRow)}
                >
                  Edit donation
                </Button>
              ) : null}
              {detailRow.editable ? (
                <Button
                  variant="destructive-outline"
                  onClick={() => void deleteRow(detailRow)}
                  disabled={deletingRowId === detailRow.id}
                >
                  {deletingRowId === detailRow.id ? "Deleting..." : "Delete donation"}
                </Button>
              ) : null}
            </div>
        </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={showAddForm}
        onOpenChange={(open) => { if (!open && !isCreating) closeAddForm(); }}
      >
        <DialogContent
          aria-labelledby="add-donation-title"
          className="sm:max-w-5xl p-4 sm:p-5"
          showCloseButton={false}
          onInteractOutside={(e) => { if (isCreating) e.preventDefault(); }}
        >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="add-donation-title" className="text-lg font-bold">
                  Add Donation
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a new ledger entry for the selected period.
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={closeAddForm}
                disabled={isCreating}
                aria-label="Close add donation dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={submitNewDonation}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Date
                  <button
                    type="button"
                    onClick={() => addDonationDateInputRef.current?.showPicker()}
                    className={`mt-1 flex h-9 w-full cursor-pointer items-center rounded-lg border bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40 ${formErrors.date ? "border-rose-300" : "border-input"}`}
                  >
                    <span className={`flex-1 text-left ${newDraft.date ? "text-foreground" : "text-muted-foreground"}`}>
                      {newDraft.date ? tableDate(newDraft.date) : "Select date"}
                    </span>
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                  <input
                    ref={addDonationDateInputRef}
                    type="date"
                    value={newDraft.date}
                    onChange={(event) => updateDraft("date", event.target.value)}
                    required
                    tabIndex={-1}
                    className="sr-only"
                  />
                  {formErrors.date && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.date}</p>
                  )}
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Name
                  <div
                    className={`relative mt-1 flex rounded-lg border shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-[hsl(var(--accent)/0.45)] focus-within:shadow-[0_0_0_2px_hsl(var(--accent)/0.22)] ${formErrors.name ? "border-rose-300" : "border-input"}`}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsNameSuggestionsOpen(false);
                      }
                    }}
                  >
                    <input
                      ref={addDonationNameInputRef}
                      value={newDraft.name}
                      onChange={(event) => {
                        updateDraft("name", event.target.value);
                        setIsNameSuggestionsOpen(true);
                      }}
                      onFocus={() => setIsNameSuggestionsOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setIsNameSuggestionsOpen(false);
                      }}
                      autoComplete="off"
                      required
                      className="min-w-0 flex-1 rounded-l-lg border-none bg-transparent px-2 py-2 text-sm text-foreground shadow-none outline-none"
                    />
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setIsNameSuggestionsOpen((open) => !open)}
                      className="flex w-10 shrink-0 items-center justify-center rounded-r-lg border-l border-input bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                      aria-label="Toggle name suggestions"
                      aria-expanded={showNameSuggestionsPanel}
                      aria-controls="donation-name-suggestions-list"
                    >
                      <ChevronDown aria-hidden="true" size={16} />
                    </button>
                    {showNameSuggestionsPanel ? (
                      <div
                        id="donation-name-suggestions-list"
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
                      >
                        {matchingNameSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              updateDraft("name", suggestion);
                              setIsNameSuggestionsOpen(false);
                            }}
                            className="block w-full rounded-lg px-2 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                          >
                            {suggestion}
                          </button>
                        ))}
                        {showCreateNameOption ? (
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              updateDraft("name", newDraft.name.trim());
                              setIsNameSuggestionsOpen(false);
                            }}
                            className="mt-1 block w-full rounded-lg border border-dashed border-border px-2 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
                          >
                            Add as new name: {newDraft.name.trim()}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.name}</p>
                  )}
                </div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Amount
                  <AmountInput
                    min={0}
                    step="0.01"
                    value={newDraft.amount}
                    onChange={(event) => updateDraft("amount", event.target.value)}
                    className={`mt-1 rounded-lg ${formErrors.amount ? "border-rose-300 focus:border-rose-500" : ""}`}
                    required
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-xs text-rose-600">{formErrors.amount}</p>
                  )}
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Notes / Description
                  <Input
                    type="text"
                    value={newDraft.memo}
                    onChange={(event) => updateDraft("memo", event.target.value)}
                    className="mt-1 rounded-lg"
                  />
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Status
                  <select
                    value={newDraft.status}
                    onChange={(event) => updateDraft("status", event.target.value)}
                    className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-lg border px-3 py-1 text-base outline-none md:text-sm mt-1"
                  >
                    {DONATION_STATUSES.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={isCreating}
                  >
                    {isCreating ? "Saving..." : "Save Donation"}
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={closeAddForm}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                </div>
                {createMessage ? (
                  <p
                    className={`text-xs ${
                      createMessage.tone === "error"
                        ? "text-rose-600"
                        : "text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {createMessage.text}
                  </p>
                ) : null}
              </div>
            </form>
        </DialogContent>
      </Dialog>

      <ResponsiveModal
        open={!!givingHistoryName}
        onOpenChange={(open) => { if (!open) setGivingHistoryName(null); }}
      >
        {givingHistoryName ? (
          <ResponsiveModalContent
            aria-labelledby="giving-history-title"
            dialogClassName="rounded-3xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl"
            showCloseButton={false}
          >
            <CharityGivingHistory
              charityName={givingHistoryName}
              onBack={() => setGivingHistoryName(null)}
            />
          </ResponsiveModalContent>
        ) : null}
      </ResponsiveModal>
    </div>
  );
}
