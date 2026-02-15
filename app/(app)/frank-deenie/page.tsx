"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ChevronDown, DollarSign, Download, MoreHorizontal, PieChart, Plus, Users, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { FrankDeenieYearSplitChart } from "@/components/frank-deenie/year-split-chart";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { DataTableHeadRow, DataTableRow, DataTableSortButton } from "@/components/ui/data-table";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FrankDeenieDonationRow, FrankDeenieSnapshot } from "@/lib/types";
import { currency, formatNumber, parseNumberInput, toISODate } from "@/lib/utils";

type SortKey = "date" | "type" | "name" | "memo" | "split" | "amount" | "status";
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
  type: string;
  status: string;
}

interface DonationExportRow {
  date: string;
  name: string;
  type: string;
  memo: string;
  split: string;
  amount: number;
  status: string;
  source: string;
}

const DEFAULT_FILTERS: DonationFilters = {
  search: "",
  type: "all",
  status: "all"
};

const DONATION_STATUSES = ["Gave", "Planned"] as const;
const SHOW_FRANK_DEENIE_IMPORT = false;
const EXPORT_HEADERS = ["Date", "Name", "Type", "Memo", "Split", "Amount", "Status", "Source"] as const;

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
  return new Date(parsed).toLocaleDateString("en-US");
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
    row.type,
    row.memo,
    row.split,
    row.amount.toFixed(2),
    row.status,
    row.source
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

export default function FrankDeeniePage() {
  const { user } = useAuth();
  const canAccess = user ? ["oversight", "admin", "manager"].includes(user.role) : false;

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [filters, setFilters] = useState<DonationFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDraft, setNewDraft] = useState<DonationDraft>(() => initialDraftForYear(null));
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
  const addDonationNameInputRef = useRef<HTMLInputElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

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
    { refreshInterval: 45_000 }
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

  const typeOptions = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...new Set(data.rows.map((row) => row.type.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) {
      return [];
    }

    const search = normalized(filters.search);

    const scopedRows = data.rows.filter((row) => {
      if (filters.type !== "all" && row.type !== filters.type) {
        return false;
      }

      if (filters.status !== "all" && row.status !== filters.status) {
        return false;
      }

      if (search) {
        const haystack = `${row.name} ${row.memo} ${row.split} ${row.status} ${row.type}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });

    return [...scopedRows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "date") {
        comparison = a.date.localeCompare(b.date);
      } else if (sortKey === "type") {
        comparison = a.type.localeCompare(b.type);
      } else if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === "memo") {
        comparison = a.memo.localeCompare(b.memo);
      } else if (sortKey === "split") {
        comparison = a.split.localeCompare(b.split);
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
        type: row.type.trim(),
        memo: row.memo.trim(),
        split: row.split.trim(),
        amount: row.amount,
        status: row.status.trim(),
        source: row.source === "children" ? "Children" : "Frank & Deenie"
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
    setNewDraft(initialDraftForYear(selectedYear));
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setCreateMessage(null);
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
      await mutate();
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
      await mutate();
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

  const submitNewDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateMessage(null);

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
      await mutate();
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
      await mutate();
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
    return <p className="text-sm text-zinc-500">Loading Frank &amp; Deenie donations...</p>;
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
    return <p className="text-sm text-zinc-500">Loading Frank &amp; Deenie donations...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-sm text-rose-600">
        Failed to load Frank &amp; Deenie donations{error ? `: ${error.message}` : "."}
      </p>
    );
  }

  return (
    <div className="page-stack pb-6">
      <GlassCard className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Frank &amp; Deenie</CardLabel>
            <CardValue>Donation Ledger</CardValue>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Track Frank &amp; Deenie giving, with optional Children donations from this app.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <label className="text-xs font-semibold text-zinc-500">
              Year
              <select
                className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-8 rounded-md border px-3 py-1 text-sm outline-none mt-1 block"
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
            </label>
            <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-xs font-semibold dark:border-zinc-700">
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
              <p className="text-xs text-zinc-500">
                Showing {formatNumber(filteredRows.length)} rows | Snapshot total {currency(data.totals.overall)}
              </p>
            </div>
            <div className="relative shrink-0" ref={exportMenuRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsExportMenuOpen((current) => !current);
                  setExportMessage(null);
                }}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExportMenuOpen ? "rotate-180" : ""}`} />
              </Button>
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

          <FilterPanel className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
            <label className="text-xs font-semibold text-zinc-500">
              Search
              <Input
                type="text"
                value={filters.search}
                onChange={(event) => setFilter("search", event.target.value)}
                onFocus={() => setExportMessage(null)}
                placeholder="Name, type, memo, split"
                className="mt-1 normal-case"
              />
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Type
              <select
                value={filters.type}
                onChange={(event) => setFilter("type", event.target.value)}
                className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-md border px-3 py-1 text-base outline-none md:text-sm mt-1 normal-case"
              >
                <option value="all">All</option>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Status
              <select
                value={filters.status}
                onChange={(event) => setFilter("status", event.target.value)}
                className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-md border px-3 py-1 text-base outline-none md:text-sm mt-1 normal-case"
              >
                <option value="all">All</option>
                {DONATION_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setExportMessage(null);
                  setIsExportMenuOpen(false);
                }}
                className="w-full xl:w-auto"
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

          <div
            className="max-h-[62vh] overflow-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800"
            onClick={() => {
              setOpenActionMenuRowId(null);
              setIsExportMenuOpen(false);
            }}
          >
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[6.75rem]" />
                <col className="w-[14rem]" />
                <col />
                <col className="w-[7.5rem]" />
                <col className="w-[7rem]" />
                <col className="w-[3.5rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-card">
                <DataTableHeadRow>
                  <th className="px-2 py-2">
                    <DataTableSortButton onClick={() => toggleSort("date")}>
                      Date{sortMarker("date")}
                    </DataTableSortButton>
                  </th>
                  <th className="px-2 py-2">
                    <DataTableSortButton onClick={() => toggleSort("name")}>
                      Name{sortMarker("name")}
                    </DataTableSortButton>
                  </th>
                  <th className="px-2 py-2">Details</th>
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
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-center text-sm text-zinc-500" colSpan={6}>
                      No donations match the selected filters for {selectedYearLabel}.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const rowMessage = rowMessageById[row.id];
                    const detailsText = [row.memo.trim(), row.split.trim()].filter(Boolean).join(" | ");

                    return (
                      <Fragment key={row.id}>
                        <DataTableRow
                          className={`align-middle ${
                            row.source === "children" ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          <td className="px-2 py-3 text-xs text-zinc-500 align-middle">{tableDate(row.date)}</td>
                          <td className="px-2 py-3 align-middle">
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setDetailRowId(row.id)}
                                className="w-full truncate text-left font-semibold hover:underline"
                                title={row.name}
                              >
                                {row.name}
                              </button>
                              {row.source === "children" ? (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                  <Users className="h-3 w-3" />
                                  Children
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-3 align-middle">
                            <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-500" title={row.type}>
                              {row.type}
                            </p>
                            <p className="truncate text-xs text-zinc-500" title={detailsText || "No memo or split details"}>
                              {detailsText || "No memo or split details"}
                            </p>
                          </td>
                          <td className="px-2 py-3 text-right text-xs text-zinc-500 tabular-nums align-middle">
                            {formatNumber(row.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-3 align-middle">
                            <span
                              className={`inline-flex min-w-[5.25rem] justify-center rounded-full border px-3 py-0.5 text-xs font-semibold ${
                                row.status === "Planned"
                                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-2 py-3 align-middle">
                            <div className="relative flex justify-end">
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenActionMenuRowId((current) => (current === row.id ? null : row.id));
                                }}
                                aria-label="Open actions"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                              {openActionMenuRowId === row.id ? (
                                <div
                                  className="absolute right-0 top-9 z-30 w-36 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDetailRowId(row.id);
                                      setOpenActionMenuRowId(null);
                                    }}
                                    className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
                                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
                                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
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
                <p className="text-xs text-zinc-500">
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
            />
            <MetricCard
              title="CHILDREN"
              value={currency(data.totals.children)}
              icon={Users}
              tone="indigo"
            />
            <MetricCard title="VISIBLE TOTAL" value={currency(visibleTotal)} icon={PieChart} tone="amber" />
          </section>

          {SHOW_FRANK_DEENIE_IMPORT && user.role === "oversight" ? (
            <GlassCard>
              <CardLabel>Import Frank &amp; Deenie CSV</CardLabel>
              <p className="mt-1 text-sm text-zinc-500">
                Required headers:{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
                  date,name,amount
                </code>
                . Optional: type, memo, split, status.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
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
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-zinc-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-100 dark:text-zinc-300 dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-zinc-200 dark:hover:file:bg-zinc-800"
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
                <p className="mt-1 text-xs text-zinc-500">{detailRow.name}</p>
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
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Edit</span>
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                </div>
                <form className="mt-3 grid gap-3" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="text-xs font-semibold text-zinc-500">
                    Date
                    <Input
                      type="date"
                      value={editDraft.date}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, date: event.target.value } : current))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-zinc-500">
                    Type
                    <Input
                      type="text"
                      value={editDraft.type}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, type: event.target.value } : current))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-zinc-500">
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
                  <label className="text-xs font-semibold text-zinc-500">
                    Amount
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editDraft.amount}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, amount: event.target.value } : current))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-zinc-500">
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
                  <label className="text-xs font-semibold text-zinc-500">
                    Split
                    <Input
                      type="text"
                      value={editDraft.split}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, split: event.target.value } : current))
                      }
                      className="mt-1"
                    />
                  </label>
                </div>
                <label className="text-xs font-semibold text-zinc-500">
                  Memo / Description
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
              <dl className="mt-4 grid gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/40 md:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Date
                  </dt>
                  <dd className="mt-1 font-medium">{tableDate(detailRow.date)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Type
                  </dt>
                  <dd className="mt-1 font-medium">{detailRow.type}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Amount
                  </dt>
                  <dd className="mt-1 text-lg font-bold">{currency(detailRow.amount)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Status
                  </dt>
                  <dd className="mt-1 font-medium">{detailRow.status}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Split
                  </dt>
                  <dd className="mt-1 font-medium">{detailRow.split || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Source
                  </dt>
                  <dd className="mt-1 font-medium">
                    {detailRow.source === "children" ? "Children" : "Frank & Deenie"}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Memo / Description
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
                  variant="outline"
                  onClick={() => void deleteRow(detailRow)}
                  disabled={deletingRowId === detailRow.id}
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/20"
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
                <p className="mt-1 text-xs text-zinc-500">
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold text-zinc-500">
                  Date
                  <Input
                    type="date"
                    value={newDraft.date}
                    onChange={(event) => setNewDraft((current) => ({ ...current, date: event.target.value }))}
                    className="mt-1 rounded-lg"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-500">
                  Type
                  <Input
                    type="text"
                    value={newDraft.type}
                    onChange={(event) => setNewDraft((current) => ({ ...current, type: event.target.value }))}
                    className="mt-1 rounded-lg"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-500">
                  Name
                  <Input
                    ref={addDonationNameInputRef}
                    type="text"
                    value={newDraft.name}
                    onChange={(event) => setNewDraft((current) => ({ ...current, name: event.target.value }))}
                    className="mt-1 rounded-lg"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-500">
                  Amount
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newDraft.amount}
                    onChange={(event) => setNewDraft((current) => ({ ...current, amount: event.target.value }))}
                    className="mt-1 rounded-lg"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-500">
                  Memo / Description
                  <Input
                    type="text"
                    value={newDraft.memo}
                    onChange={(event) => setNewDraft((current) => ({ ...current, memo: event.target.value }))}
                    className="mt-1 rounded-lg"
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-500">
                  Split
                  <Input
                    type="text"
                    value={newDraft.split}
                    onChange={(event) => setNewDraft((current) => ({ ...current, split: event.target.value }))}
                    className="mt-1 rounded-lg"
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-500">
                  Status
                  <select
                    value={newDraft.status}
                    onChange={(event) => setNewDraft((current) => ({ ...current, status: event.target.value }))}
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
    </div>
  );
}
