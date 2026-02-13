"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
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

const DEFAULT_FILTERS: DonationFilters = {
  search: "",
  type: "all",
  status: "all"
};

const DONATION_STATUSES = ["Gave", "Planned"] as const;
const SHOW_FRANK_DEENIE_IMPORT = false;

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

export default function FrankDeeniePage() {
  const { user } = useAuth();
  const canAccess = user ? ["oversight", "admin", "manager"].includes(user.role) : false;

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [filters, setFilters] = useState<DonationFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [highlightAddCard, setHighlightAddCard] = useState(false);
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DonationDraft | null>(null);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [rowMessageById, setRowMessageById] = useState<
    Record<string, { tone: "success" | "error"; text: string }>
  >({});
  const addDonationCardRef = useRef<HTMLDivElement | null>(null);
  const addDonationNameInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!showAddForm) {
      setHighlightAddCard(false);
      return;
    }

    setHighlightAddCard(true);
    const frame = window.requestAnimationFrame(() => {
      addDonationNameInputRef.current?.focus();
    });
    const timeout = window.setTimeout(() => {
      setHighlightAddCard(false);
    }, 1400);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [showAddForm]);

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

  const visibleTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.amount, 0),
    [filteredRows]
  );
  const selectedYearLabel = selectedYear === null ? "all years" : String(selectedYear);

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

  if (!user) {
    return <p className="text-sm text-zinc-500">Loading Frank &amp; Deenie donations...</p>;
  }

  if (!canAccess) {
    return (
      <Card>
        <CardTitle>Frank &amp; Deenie</CardTitle>
        <p className="mt-2 text-sm text-rose-600">
          This page is available only to Oversight, Admin, and Manager users.
        </p>
      </Card>
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
    <div className="space-y-4 pb-6">
      <Card className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Frank &amp; Deenie</CardTitle>
            <CardValue>Donation Ledger</CardValue>
            <p className="mt-1 text-sm text-zinc-500">
              Track Frank &amp; Deenie giving, with optional Children donations from this app.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <label className="text-xs font-semibold text-zinc-500">
              Year
              <select
                className="mt-1 block rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                className="h-4 w-4"
              />
              Include Children
            </label>
            <button
              type="button"
              onClick={() => {
                setShowAddForm((current) => !current);
                setCreateMessage(null);
                setNewDraft(initialDraftForYear(selectedYear));
              }}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white"
            >
              {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showAddForm ? "Close" : "Add Donation"}
            </button>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardTitle>Frank &amp; Deenie</CardTitle>
          <CardValue>{currency(data.totals.frankDeenie)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Children</CardTitle>
          <CardValue>{currency(data.totals.children)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Visible Total</CardTitle>
          <CardValue>{currency(visibleTotal)}</CardValue>
        </Card>
      </section>

      {showAddForm ? (
        <div
          ref={addDonationCardRef}
          className={`rounded-2xl transition-all duration-300 ${
            highlightAddCard
              ? "ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-transparent shadow-[0_0_0_6px_rgba(16,185,129,0.12)] motion-safe:animate-[pulse_700ms_ease-out_1]"
              : ""
          }`}
        >
          <Card>
          <CardTitle>Add Donation</CardTitle>
          <form className="mt-3 grid gap-3" onSubmit={submitNewDonation}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold text-zinc-500">
                Date
                <input
                  type="date"
                  value={newDraft.date}
                  onChange={(event) => setNewDraft((current) => ({ ...current, date: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Type
                <input
                  type="text"
                  value={newDraft.type}
                  onChange={(event) => setNewDraft((current) => ({ ...current, type: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Name
                <input
                  ref={addDonationNameInputRef}
                  type="text"
                  value={newDraft.name}
                  onChange={(event) => setNewDraft((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Amount
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newDraft.amount}
                  onChange={(event) => setNewDraft((current) => ({ ...current, amount: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Memo / Description
                <input
                  type="text"
                  value={newDraft.memo}
                  onChange={(event) => setNewDraft((current) => ({ ...current, memo: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Split
                <input
                  type="text"
                  value={newDraft.split}
                  onChange={(event) => setNewDraft((current) => ({ ...current, split: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-500">
                Status
                <select
                  value={newDraft.status}
                  onChange={(event) => setNewDraft((current) => ({ ...current, status: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {DONATION_STATUSES.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isCreating}
                className="min-h-10 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {isCreating ? "Saving..." : "Save Donation"}
              </button>
              {createMessage ? (
                <p className={`text-xs ${createMessage.tone === "error" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {createMessage.text}
                </p>
              ) : null}
            </div>
          </form>
          </Card>
        </div>
      ) : null}

      {SHOW_FRANK_DEENIE_IMPORT && user.role === "oversight" ? (
        <Card>
          <CardTitle>Import Frank &amp; Deenie CSV</CardTitle>
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
            <button
              type="submit"
              disabled={importingCsv}
              className="min-h-11 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {importingCsv ? "Importing..." : "Import CSV"}
            </button>
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
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Donations</CardTitle>
          <p className="text-xs text-zinc-500">
            Showing {formatNumber(filteredRows.length)} rows | Snapshot total {currency(data.totals.overall)}
          </p>
        </div>

        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] table-auto text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">
                  <button type="button" onClick={() => toggleSort("date")} className="font-semibold">
                    Date{sortMarker("date")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => toggleSort("type")} className="font-semibold">
                    Type{sortMarker("type")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => toggleSort("name")} className="font-semibold">
                    Name{sortMarker("name")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => toggleSort("memo")} className="font-semibold">
                    Memo/Description{sortMarker("memo")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => toggleSort("split")} className="font-semibold">
                    Split{sortMarker("split")}
                  </button>
                </th>
                <th className="px-2 py-2 text-right">
                  <button type="button" onClick={() => toggleSort("amount")} className="font-semibold">
                    Amount ($){sortMarker("amount")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => toggleSort("status")} className="font-semibold">
                    Status{sortMarker("status")}
                  </button>
                </th>
                <th className="w-24 px-2 py-2" />
              </tr>
              <tr className="border-b text-xs text-zinc-500">
                <th className="px-2 py-2" />
                <th className="px-2 py-2">
                  <select
                    value={filters.type}
                    onChange={(event) => setFilter("type", event.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="all">All</option>
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2">
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Name, memo, split"
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </th>
                <th className="px-2 py-2" />
                <th className="px-2 py-2" />
                <th className="px-2 py-2" />
                <th className="px-2 py-2">
                  <select
                    value={filters.status}
                    onChange={(event) => setFilter("status", event.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs normal-case dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="all">All</option>
                    {DONATION_STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-6 text-center text-sm text-zinc-500" colSpan={8}>
                    No donations match the selected filters for {selectedYearLabel}.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isEditing = editingId === row.id;
                  const draft = isEditing ? editDraft : null;
                  const rowMessage = rowMessageById[row.id];
                  const isSaving = savingRowId === row.id;
                  const isDeleting = deletingRowId === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-b align-middle ${
                          row.source === "children" ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                        }`}
                      >
                        <td className="px-2 py-3 text-xs text-zinc-500 align-middle">
                          {isEditing && draft ? (
                            <input
                              type="date"
                              value={draft.date}
                              onChange={(event) =>
                                setEditDraft((current) =>
                                  current ? { ...current, date: event.target.value } : current
                                )
                              }
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          ) : (
                            tableDate(row.date)
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs text-zinc-500 align-middle">
                          {isEditing && draft ? (
                            <input
                              type="text"
                              value={draft.type}
                              onChange={(event) =>
                                setEditDraft((current) =>
                                  current ? { ...current, type: event.target.value } : current
                                )
                              }
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          ) : (
                            row.type
                          )}
                        </td>
                        <td className="px-2 py-3 align-middle">
                          {isEditing && draft ? (
                            <input
                              type="text"
                              value={draft.name}
                              onChange={(event) =>
                                setEditDraft((current) =>
                                  current ? { ...current, name: event.target.value } : current
                                )
                              }
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          ) : (
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{row.name}</p>
                              {row.source === "children" ? (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                  <Users className="h-3 w-3" />
                                  Children
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs text-zinc-500 align-middle">
                          {isEditing && draft ? (
                            <input
                              type="text"
                              value={draft.memo}
                              onChange={(event) =>
                                setEditDraft((current) =>
                                  current ? { ...current, memo: event.target.value } : current
                                )
                              }
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          ) : (
                            row.memo || "—"
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs text-zinc-500 align-middle">
                          {isEditing && draft ? (
                            <input
                              type="text"
                              value={draft.split}
                              onChange={(event) =>
                                setEditDraft((current) =>
                                  current ? { ...current, split: event.target.value } : current
                                )
                              }
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          ) : (
                            row.split || "—"
                          )}
                        </td>
                        <td className="px-2 py-3 text-right text-xs text-zinc-500 tabular-nums align-middle">
                          {isEditing && draft ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.amount}
                              onChange={(event) =>
                                setEditDraft((current) =>
                                  current ? { ...current, amount: event.target.value } : current
                                )
                              }
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          ) : (
                            formatNumber(row.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                          )}
                        </td>
                        <td className="px-2 py-3 align-middle">
                          {isEditing && draft ? (
                            <select
                              value={draft.status}
                              onChange={(event) =>
                                setEditDraft((current) =>
                                  current ? { ...current, status: event.target.value } : current
                                )
                              }
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              {DONATION_STATUSES.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>
                                  {statusOption}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-flex min-w-[5.25rem] justify-center rounded-full border px-3 py-0.5 text-xs font-semibold ${
                                row.status === "Planned"
                                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                              }`}
                            >
                              {row.status}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 align-middle">
                          {row.editable ? (
                            isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void saveEdit()}
                                  disabled={isSaving}
                                  className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                                >
                                  {isSaving ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={isSaving}
                                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => beginEdit(row)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  aria-label="Edit donation"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteRow(row)}
                                  disabled={isDeleting}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/20"
                                  aria-label="Delete donation"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )
                          ) : null}
                        </td>
                      </tr>
                      {rowMessage ? (
                        <tr className="border-b">
                          <td
                            colSpan={8}
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
      </Card>
    </div>
  );
}
