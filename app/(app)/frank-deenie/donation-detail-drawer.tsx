"use client";

import { memo, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, History, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { FrankDeenieDonationRow } from "@/lib/types";
import { currency, parseNumberInput } from "@/lib/utils";
import { getProposerDisplayName } from "@/lib/proposer-display-names";

const DONATION_STATUSES = ["Gave", "Planned"] as const;

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function byDisplay(row: FrankDeenieDonationRow): string {
  if (row.source === "children") {
    return row.proposedBy ? getProposerDisplayName(row.proposedBy) : "—";
  }
  return "F&D";
}

export type DetailMode = "view" | "edit" | "edit-notes" | "edit-return";

interface DonationDetailDrawerProps {
  row: FrankDeenieDonationRow | null;
  isAdmin: boolean;
  readOnly?: boolean;
  deletingRowId: string | null;
  initialMode: DetailMode;
  onClose: () => void;
  onMutate: () => void;
  onBeginReturn: (row: FrankDeenieDonationRow) => void;
  onRequestDelete: (row: FrankDeenieDonationRow) => void;
  onViewHistory: (name: string) => void;
}

interface DonationDraft {
  date: string;
  type: string;
  name: string;
  memo: string;
  split: string;
  amount: string;
  status: string;
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

export const DonationDetailDrawer = memo(function DonationDetailDrawer({
  row,
  isAdmin,
  readOnly,
  deletingRowId,
  initialMode,
  onClose,
  onMutate,
  onBeginReturn,
  onRequestDelete,
  onViewHistory,
}: DonationDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<DonationDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [isEditingReturn, setIsEditingReturn] = useState(false);
  const [returnDraft, setReturnDraft] = useState<{ date: string; amount: string } | null>(null);
  const [savingReturn, setSavingReturn] = useState(false);

  const editDateRef = useRef<HTMLInputElement | null>(null);
  const returnDateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!row) {
      setIsEditing(false);
      setEditDraft(null);
      setIsEditingNotes(false);
      setNotesValue("");
      setIsEditingReturn(false);
      setReturnDraft(null);
      return;
    }

    if (initialMode === "edit" && row.editable) {
      setIsEditing(true);
      setEditDraft(rowToDraft(row));
      setIsEditingNotes(false);
      setIsEditingReturn(false);
      setReturnDraft(null);
    } else if (initialMode === "edit-notes") {
      setIsEditingNotes(true);
      setNotesValue(row.memo);
      setIsEditing(false);
      setEditDraft(null);
      setIsEditingReturn(false);
      setReturnDraft(null);
    } else if (initialMode === "edit-return" && row.returnRole !== null) {
      setIsEditingReturn(true);
      const absAmount = Math.abs(row.amount);
      setReturnDraft({ date: row.date, amount: Number.isInteger(absAmount) ? String(absAmount) : absAmount.toFixed(2) });
      setIsEditing(false);
      setEditDraft(null);
      setIsEditingNotes(false);
      setNotesValue("");
    } else {
      setIsEditing(false);
      setEditDraft(null);
      setIsEditingNotes(false);
      setNotesValue("");
      setIsEditingReturn(false);
      setReturnDraft(null);
    }
  }, [row, initialMode]);

  const beginEdit = () => {
    if (!row?.editable) return;
    setIsEditing(true);
    setEditDraft(rowToDraft(row));
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDraft(null);
  };

  const beginReturnEdit = () => {
    if (!row || row.returnRole === null) return;
    const absAmount = Math.abs(row.amount);
    setIsEditingReturn(true);
    setReturnDraft({ date: row.date, amount: Number.isInteger(absAmount) ? String(absAmount) : absAmount.toFixed(2) });
  };

  const cancelReturnEdit = () => {
    setIsEditingReturn(false);
    setReturnDraft(null);
  };

  const saveReturnEdit = async () => {
    if (!row || !returnDraft) return;
    const parsedAmount = parseNumberInput(returnDraft.amount);
    if (parsedAmount === null || parsedAmount < 0) {
      toast.error("Amount must be a non-negative number.");
      return;
    }

    setSavingReturn(true);
    try {
      const isChildrenOriginal = row.source === "children" && row.returnRole === "original";

      if (isChildrenOriginal) {
        const proposalId = row.id.startsWith("children:") ? row.id.slice("children:".length) : row.id;
        const response = await fetch("/api/frank-deenie/children-original", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proposalId, date: returnDraft.date, amount: parsedAmount }),
        });
        const payload = await response.json().catch(() => ({} as Record<string, unknown>));
        if (!response.ok) {
          throw new Error(String(payload.error ?? "Failed to update donation."));
        }
      } else {
        const apiAmount = row.returnRole === "reversal" ? -parsedAmount : parsedAmount;
        const response = await fetch(`/api/frank-deenie/${row.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: returnDraft.date, amount: apiAmount }),
        });
        const payload = await response.json().catch(() => ({} as Record<string, unknown>));
        if (!response.ok) {
          throw new Error(String(payload.error ?? "Failed to update donation."));
        }
      }

      toast.success("Donation updated.");
      setIsEditingReturn(false);
      setReturnDraft(null);
      onMutate();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to update donation.");
    } finally {
      setSavingReturn(false);
    }
  };

  const saveEdit = async () => {
    if (!row || !editDraft) return;
    const parsedAmount = parseNumberInput(editDraft.amount);
    if (parsedAmount === null || parsedAmount < 0) {
      toast.error("Amount must be a non-negative number.");
      return;
    }

    setSavingEdit(true);
    try {
      const response = await fetch(`/api/frank-deenie/${row.id}`, {
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

      toast.success("Donation updated.");
      setIsEditing(false);
      setEditDraft(null);
      onMutate();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to update donation.");
    } finally {
      setSavingEdit(false);
    }
  };

  const beginNotesEdit = () => {
    if (!row) return;
    setIsEditingNotes(true);
    setNotesValue(row.memo);
  };

  const cancelNotesEdit = () => {
    setIsEditingNotes(false);
    setNotesValue("");
  };

  const saveNotesEdit = async () => {
    if (!row) return;
    setSavingNotes(true);
    try {
      const response = await fetch(`/api/frank-deenie/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memo: notesValue.trim() || null })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to update notes."));
      }

      toast.success("Notes updated.");
      setIsEditingNotes(false);
      setNotesValue("");
      onMutate();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to update notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setEditDraft(null);
    setIsEditingNotes(false);
    setNotesValue("");
    setIsEditingReturn(false);
    setReturnDraft(null);
    onClose();
  };

  return (
    <ResponsiveModal open={!!row} onOpenChange={(open) => { if (!open) handleClose(); }}>
      {row ? (
        <ResponsiveModalContent
          aria-labelledby="donation-details-title"
          dialogClassName="max-w-3xl rounded-3xl p-4 sm:p-5"
          showCloseButton={false}
          footer={!readOnly && (row.editable || isAdmin || (row.returnRole === null && row.status === "Gave") || row.returnRole !== null) ? (
            <div className="flex flex-wrap items-center gap-3 pt-3">
              {row.editable && !isEditing ? (
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={beginEdit}>
                  Edit donation
                </Button>
              ) : null}
              {!row.editable && row.returnRole !== null && !isEditingReturn ? (
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={beginReturnEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : null}
              {isAdmin && !row.editable && !row.returnRole && !isEditingNotes ? (
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={beginNotesEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit notes
                </Button>
              ) : null}
              {row.returnRole === null && row.status === "Gave" ? (
                <Button variant="outline" className="flex-1 sm:flex-none border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20" onClick={() => onBeginReturn(row)}>
                  Mark as Returned
                </Button>
              ) : null}
              {row.editable && !row.returnRole ? (
                <Button
                  variant="destructive-outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => onRequestDelete(row)}
                  disabled={deletingRowId === row.id}
                >
                  {deletingRowId === row.id ? "Deleting..." : "Delete donation"}
                </Button>
              ) : null}
            </div>
          ) : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className={`text-2xl font-bold tabular-nums ${row.returnRole === "original" ? "line-through text-muted-foreground" : row.returnRole === "reversal" ? "text-rose-600 dark:text-rose-400" : ""}`}>
                {row.returnRole === "reversal" ? `-${currency(Math.abs(row.amount))}` : currency(row.amount)}
              </p>
              <h2 id="donation-details-title" className={`mt-1 text-base font-semibold leading-snug ${row.returnRole === "original" ? "line-through text-muted-foreground" : ""}`}>
                {row.name}
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    row.source === "children"
                      ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                      : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  }`}
                >
                  {row.source === "children" ? "Children" : "Frank & Deenie"}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    row.status === "Planned"
                      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                  }`}
                >
                  {row.status}
                </span>
                {row.returnRole === "original" ? (
                  <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300">
                    Returned{row.returnedAt ? ` ${formatDate(row.returnedAt)}` : ""}
                  </span>
                ) : row.returnRole === "reversal" ? (
                  <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300">
                    Reversal
                  </span>
                ) : row.returnRole === "replacement" ? (
                  <span className="inline-flex rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300">
                    Reissued
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onViewHistory(row.name)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <History className="h-3 w-3" />
                  History
                </button>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleClose}
              aria-label="Close donation details"
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="my-4 h-px bg-border" />

          {isEditing && editDraft ? (
            <>
              <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Date
                    <button
                      type="button"
                      onClick={() => editDateRef.current?.showPicker()}
                      className="mt-1 flex h-10 w-full cursor-pointer items-center rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40"
                    >
                      <span className={`flex-1 text-left ${editDraft.date ? "text-foreground" : "text-muted-foreground"}`}>
                        {editDraft.date ? formatDate(editDraft.date) : "Select date"}
                      </span>
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                    <input
                      ref={editDateRef}
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
                      className="mt-1 h-10 rounded-lg"
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
                      className="mt-1 h-10 rounded-lg"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Status
                    <select
                      value={editDraft.status}
                      onChange={(event) =>
                        setEditDraft((current) => (current ? { ...current, status: event.target.value } : current))
                      }
                      className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 w-full rounded-lg border px-3 py-1 text-base outline-none sm:text-sm mt-1"
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
                    className="mt-1 h-10 rounded-lg"
                  />
                </label>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="prominent"
                    className="flex-1 sm:flex-none"
                    onClick={() => void saveEdit()}
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={cancelEdit}
                    disabled={savingEdit}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </>
          ) : isEditingReturn && returnDraft ? (
            <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  Date
                  <button
                    type="button"
                    onClick={() => returnDateRef.current?.showPicker()}
                    className="mt-1 flex h-10 w-full cursor-pointer items-center rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40"
                  >
                    <span className={`flex-1 text-left ${returnDraft.date ? "text-foreground" : "text-muted-foreground"}`}>
                      {returnDraft.date ? formatDate(returnDraft.date) : "Select date"}
                    </span>
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                  <input
                    ref={returnDateRef}
                    type="date"
                    value={returnDraft.date}
                    onChange={(event) =>
                      setReturnDraft((current) => (current ? { ...current, date: event.target.value } : current))
                    }
                    tabIndex={-1}
                    className="sr-only"
                  />
                </div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Amount
                  <AmountInput
                    min={0}
                    step="0.01"
                    value={returnDraft.amount}
                    onChange={(event) =>
                      setReturnDraft((current) => (current ? { ...current, amount: event.target.value } : current))
                    }
                    className="mt-1 h-10 rounded-lg"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="prominent"
                  className="flex-1 sm:flex-none"
                  onClick={() => void saveReturnEdit()}
                  disabled={savingReturn}
                >
                  {savingReturn ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={cancelReturnEdit}
                  disabled={savingReturn}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Date
                  </dt>
                  <dd className="mt-0.5 font-medium">{formatDate(row.date)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Source
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {row.source === "children" ? "Children" : "Frank & Deenie"}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Proposed by
                </dt>
                <dd className="mt-0.5 font-medium">{byDisplay(row)}</dd>
              </div>
              {isEditingNotes ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes
                  </dt>
                  <div className="mt-1 space-y-2">
                    <Input
                      type="text"
                      value={notesValue}
                      onChange={(event) => setNotesValue(event.target.value)}
                      placeholder="Add notes..."
                      className="h-9 rounded-lg text-sm"
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter") { event.preventDefault(); void saveNotesEdit(); }
                        if (event.key === "Escape") cancelNotesEdit();
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="prominent"
                        onClick={() => void saveNotesEdit()}
                        disabled={savingNotes}
                      >
                        {savingNotes ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelNotesEdit} disabled={savingNotes}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : row.memo || isAdmin ? (
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes
                    {isAdmin && !isEditing ? (
                      <button
                        type="button"
                        onClick={beginNotesEdit}
                        className="inline-flex items-center rounded-md p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Edit notes"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    ) : null}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap font-medium text-muted-foreground">
                    {row.memo || <span className="italic text-muted-foreground/50">No notes</span>}
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </ResponsiveModalContent>
      ) : null}
    </ResponsiveModal>
  );
});
