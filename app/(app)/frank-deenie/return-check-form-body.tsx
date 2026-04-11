"use client";

import { memo, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { FrankDeenieDonationRow } from "@/lib/types";
import { currency, parseNumberInput, toISODate } from "@/lib/utils";

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export interface ReturnCheckFormBodyProps {
  row: FrankDeenieDonationRow;
  /** Reset the draft when this value changes (e.g. wrapper reopens on a new row). */
  resetKey?: string | number;
  onReturned: () => void;
  onCancel: () => void;
  /** Notify parent of saving state (for dismiss protection). */
  onSavingChange?: (isSaving: boolean) => void;
  /** If true, render Save/Cancel inline at the bottom of the body. */
  renderInlineActions?: boolean;
  /** Optional heading id so the wrapper's aria-labelledby can target it. */
  headingId?: string;
  /** When true, render the title + description block. */
  showHeader?: boolean;
}

export const ReturnCheckFormBody = memo(function ReturnCheckFormBody({
  row,
  resetKey,
  onReturned,
  onCancel,
  onSavingChange,
  renderInlineActions = true,
  headingId = "return-check-title",
  showHeader = true,
}: ReturnCheckFormBodyProps) {
  const [draft, setDraft] = useState({ returnedDate: "", newDonationDate: "", newAmount: "" });
  const [pendingReissue, setPendingReissue] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const returnDateRef = useRef<HTMLInputElement | null>(null);
  const newDonationDateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft({
      returnedDate: toISODate(new Date()),
      newDonationDate: toISODate(new Date()),
      newAmount: String(row.amount),
    });
    setPendingReissue(false);
  }, [row.id, row.amount, resetKey]);

  useEffect(() => {
    onSavingChange?.(isReturning);
  }, [isReturning, onSavingChange]);

  const handleSubmit = async () => {
    if (!draft.returnedDate) {
      toast.error("Date returned is required.");
      return;
    }
    if (!pendingReissue && !draft.newDonationDate) {
      toast.error("New sent date is required, or mark as pending.");
      return;
    }
    const parsedAmount = parseNumberInput(draft.newAmount);
    if (parsedAmount === null || parsedAmount < 0) {
      toast.error("Amount must be a non-negative number.");
      return;
    }

    setIsReturning(true);
    try {
      const sourceId = row.source === "children" ? row.id.replace(/^children:/, "") : row.id;
      const response = await fetch("/api/frank-deenie/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          source: row.source,
          returnedDate: draft.returnedDate,
          newDonationDate: pendingReissue ? null : draft.newDonationDate,
          newAmount: parsedAmount,
        }),
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to mark donation as returned."));
      }
      toast.success(
        pendingReissue
          ? "Check marked as returned. Replacement donation created as pending."
          : "Check marked as returned. Replacement donation created."
      );
      onReturned();
    } catch (returnError) {
      toast.error(returnError instanceof Error ? returnError.message : "Failed to mark donation as returned.");
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div>
          <h2 id={headingId} className="text-lg font-bold text-foreground">
            Mark Check as Returned
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The original {currency(row.amount)} donation to <span className="font-semibold text-foreground">&ldquo;{row.name}&rdquo;</span> will be flagged as returned. A reversal entry and a new replacement donation will be created.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3">
        <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">
          Date Returned
          <button
            type="button"
            onClick={() => returnDateRef.current?.showPicker()}
            className="mt-1 flex h-10 w-full cursor-pointer items-center rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40"
          >
            <span className={`flex-1 text-left ${draft.returnedDate ? "text-foreground" : "text-muted-foreground"}`}>
              {draft.returnedDate ? formatDate(draft.returnedDate) : "Select date"}
            </span>
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <input
            ref={returnDateRef}
            type="date"
            value={draft.returnedDate}
            onChange={(e) => setDraft((d) => ({ ...d, returnedDate: e.target.value }))}
            tabIndex={-1}
            className="sr-only"
          />
        </div>

        <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
          New Sent Date
          <div className="mt-1 flex items-center gap-2">
            {!pendingReissue ? (
              <button
                type="button"
                onClick={() => newDonationDateRef.current?.showPicker()}
                className="flex h-10 flex-1 cursor-pointer items-center rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40"
              >
                <span className={`flex-1 text-left ${draft.newDonationDate ? "text-foreground" : "text-muted-foreground"}`}>
                  {draft.newDonationDate ? formatDate(draft.newDonationDate) : "Select date"}
                </span>
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <span className="flex h-10 flex-1 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                Pending
              </span>
            )}
            <button
              type="button"
              onClick={() => setPendingReissue((v) => !v)}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                pendingReissue
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Pending
            </button>
          </div>
          <input
            ref={newDonationDateRef}
            type="date"
            value={draft.newDonationDate}
            onChange={(e) => setDraft((d) => ({ ...d, newDonationDate: e.target.value }))}
            tabIndex={-1}
            className="sr-only"
          />
        </div>

        <label className="text-xs font-semibold text-muted-foreground">
          New Amount
          <AmountInput
            min={0}
            step="0.01"
            value={draft.newAmount}
            onChange={(e) => setDraft((d) => ({ ...d, newAmount: e.target.value }))}
            className="mt-1 h-10 rounded-lg"
          />
        </label>
      </div>

      {renderInlineActions ? (
        <div className="flex items-center gap-2 pt-1">
          <Button
            className="flex-1"
            onClick={() => void handleSubmit()}
            disabled={isReturning}
          >
            {isReturning ? "Processing..." : "Mark as Returned"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isReturning}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
});
