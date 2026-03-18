"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Input } from "@/components/ui/input";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { parseNumberInput, toISODate } from "@/lib/utils";

interface DonationDraft {
  date: string;
  type: string;
  name: string;
  memo: string;
  split: string;
  amount: string;
  status: string;
}

type DraftErrors = Partial<Record<keyof DonationDraft, string>>;

const DONATION_STATUSES = ["Gave", "Planned"] as const;

function initialDraft(year: number | null): DonationDraft {
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

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function validate(draft: DonationDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.name.trim()) errors.name = "Name is required";
  const amt = parseNumberInput(draft.amount);
  if (amt === null || amt < 0) errors.amount = "Amount must be a non-negative number";
  if (!draft.date) errors.date = "Date is required";
  return errors;
}

interface AddDonationFormProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number | null;
  nameSuggestions: string[];
  onCreated: () => void;
}

export function AddDonationForm({ open, onClose, selectedYear, nameSuggestions, onCreated }: AddDonationFormProps) {
  const [draft, setDraft] = useState<DonationDraft>(() => initialDraft(selectedYear));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft(selectedYear));
      setErrors({});
    }
  }, [open, selectedYear]);

  const updateField = (field: keyof DonationDraft, value: string) => {
    setDraft(current => {
      const updated = { ...current, [field]: value };
      setErrors(validate(updated));
      return updated;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const submitErrors = validate(draft);
    setErrors(submitErrors);
    if (Object.keys(submitErrors).length > 0) {
      toast.error("Please fix the errors below.");
      return;
    }

    const parsedAmount = parseNumberInput(draft.amount);
    if (parsedAmount === null || parsedAmount < 0) {
      toast.error("Amount must be a non-negative number.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/frank-deenie", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: draft.date,
          type: draft.type,
          name: draft.name,
          memo: draft.memo,
          split: draft.split,
          amount: parsedAmount,
          status: draft.status
        })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to create donation."));
      }

      toast.success("Donation added.");
      setDraft(initialDraft(selectedYear));
      setErrors({});
      onCreated();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : "Failed to create donation.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) onClose();
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => { if (!o) handleClose(); }}
    >
      <ResponsiveModalContent
        aria-labelledby="add-donation-title"
        dialogClassName="sm:max-w-5xl p-4 sm:p-5"
        showCloseButton={false}
        onInteractOutside={(e) => { if (isCreating) e.preventDefault(); }}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-3">
            <div className="flex items-center gap-2">
              <Button type="submit" form="add-donation-form" disabled={isCreating} className="flex-1 sm:flex-none">
                {isCreating ? "Saving..." : "Save Donation"}
              </Button>
              <Button variant="outline" type="button" onClick={handleClose} disabled={isCreating} className="flex-1 sm:flex-none">
                Cancel
              </Button>
            </div>
          </div>
        }
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
            onClick={handleClose}
            disabled={isCreating}
            aria-label="Close add donation dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form id="add-donation-form" className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="text-xs font-semibold text-muted-foreground">
              Date
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker()}
                className={`mt-1 flex h-9 w-full cursor-pointer items-center rounded-lg border bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40 ${errors.date ? "border-rose-300" : "border-input"}`}
              >
                <span className={`flex-1 text-left ${draft.date ? "text-foreground" : "text-muted-foreground"}`}>
                  {draft.date ? formatDate(draft.date) : "Select date"}
                </span>
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={draft.date}
                onChange={(event) => updateField("date", event.target.value)}
                required
                tabIndex={-1}
                className="sr-only"
              />
              {errors.date && (
                <p className="mt-1 text-xs text-rose-600">{errors.date}</p>
              )}
            </div>
            <div className="text-xs font-semibold text-muted-foreground">
              Name
              <AutocompleteInput
                value={draft.name}
                onChange={(value) => updateField("name", value)}
                suggestions={nameSuggestions}
                addNewLabel="Add as new name"
                className="mt-1 rounded-lg"
                hasError={Boolean(errors.name)}
                required
              />
              {errors.name && (
                <p className="mt-1 text-xs text-rose-600">{errors.name}</p>
              )}
            </div>
            <label className="text-xs font-semibold text-muted-foreground">
              Amount
              <AmountInput
                min={0}
                step="0.01"
                value={draft.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                className={`mt-1 rounded-lg ${errors.amount ? "border-rose-300 focus:border-rose-500" : ""}`}
                required
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-rose-600">{errors.amount}</p>
              )}
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Notes / Description
              <Input
                type="text"
                value={draft.memo}
                onChange={(event) => updateField("memo", event.target.value)}
                className="mt-1 rounded-lg"
              />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Status
              <select
                value={draft.status}
                onChange={(event) => updateField("status", event.target.value)}
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
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
