"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { FrankDeenieDonationRow } from "@/lib/types";
import { currency, parseNumberInput, toISODate } from "@/lib/utils";

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

interface ReturnCheckFormProps {
  row: FrankDeenieDonationRow | null;
  onClose: () => void;
  onReturned: () => void;
}

export function ReturnCheckForm({ row, onClose, onReturned }: ReturnCheckFormProps) {
  const [draft, setDraft] = useState({ returnedDate: "", newDonationDate: "", newAmount: "" });
  const [isReturning, setIsReturning] = useState(false);
  const returnDateRef = useRef<HTMLInputElement | null>(null);
  const newDonationDateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (row) {
      setDraft({
        returnedDate: toISODate(new Date()),
        newDonationDate: toISODate(new Date()),
        newAmount: String(row.amount),
      });
    }
  }, [row]);

  const handleSubmit = async () => {
    if (!row) return;
    if (!draft.returnedDate || !draft.newDonationDate) {
      toast.error("Both dates are required.");
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
          newDonationDate: draft.newDonationDate,
          newAmount: parsedAmount,
        }),
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to mark donation as returned."));
      }
      toast.success("Check marked as returned. Replacement donation created.");
      onReturned();
    } catch (returnError) {
      toast.error(returnError instanceof Error ? returnError.message : "Failed to mark donation as returned.");
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <ResponsiveModal
      open={row !== null}
      onOpenChange={(open) => { if (!open && !isReturning) onClose(); }}
    >
      {row ? (
        <ResponsiveModalContent
          aria-labelledby="return-check-title"
          dialogClassName="max-w-md rounded-3xl p-5"
          showCloseButton={false}
          onInteractOutside={(e) => { if (isReturning) e.preventDefault(); }}
          footer={
            <div className="flex items-center gap-2 pt-3">
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => void handleSubmit()}
                disabled={isReturning}
              >
                {isReturning ? "Processing..." : "Mark as Returned"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={onClose}
                disabled={isReturning}
              >
                Cancel
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <h2 id="return-check-title" className="text-lg font-bold text-foreground">
                Mark Check as Returned
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The original {currency(row.amount)} donation to <span className="font-semibold text-foreground">&ldquo;{row.name}&rdquo;</span> will be flagged as returned. A reversal entry and a new replacement donation will be created.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="text-xs font-semibold text-muted-foreground">
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
              <div className="text-xs font-semibold text-muted-foreground">
                New Check Date
                <button
                  type="button"
                  onClick={() => newDonationDateRef.current?.showPicker()}
                  className="mt-1 flex h-10 w-full cursor-pointer items-center rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40"
                >
                  <span className={`flex-1 text-left ${draft.newDonationDate ? "text-foreground" : "text-muted-foreground"}`}>
                    {draft.newDonationDate ? formatDate(draft.newDonationDate) : "Select date"}
                  </span>
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
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
          </div>
        </ResponsiveModalContent>
      ) : null}
    </ResponsiveModal>
  );
}
