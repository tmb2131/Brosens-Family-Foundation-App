"use client";

import { FormEvent, memo, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { FoundationEventType } from "@/lib/types";
import { parseNumberInput, toISODate } from "@/lib/utils";

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

interface FoundationEventFormProps {
  eventType: FoundationEventType | null;
  onClose: () => void;
  onCreated: () => void;
}

export const FoundationEventForm = memo(function FoundationEventForm({ eventType, onClose, onCreated }: FoundationEventFormProps) {
  const [draft, setDraft] = useState({ date: "", amount: "", memo: "" });
  const [isCreating, setIsCreating] = useState(false);
  const dateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (eventType) {
      setDraft({ date: toISODate(new Date()), amount: "", memo: "" });
    }
  }, [eventType]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!eventType) return;

    const parsedAmount = parseNumberInput(draft.amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      toast.error("Amount must be a positive number.");
      return;
    }
    if (!draft.date) {
      toast.error("Date is required.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/frank-deenie/foundation-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          date: draft.date,
          amount: parsedAmount,
          memo: draft.memo.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? "Failed to create foundation event.");
      }

      toast.success(eventType === "fund_foundation" ? "Foundation funded." : "Transfer recorded.");
      onCreated();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to create foundation event.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ResponsiveModal open={!!eventType} onOpenChange={(open) => { if (!open) onClose(); }}>
      {eventType ? (
        <ResponsiveModalContent
          aria-labelledby="foundation-event-title"
          dialogClassName="max-w-md rounded-3xl p-4 sm:p-5"
          showCloseButton
        >
          <h2 id="foundation-event-title" className="text-base font-bold">
            {eventType === "fund_foundation" ? "Fund Foundation" : "Transfer into Foundation"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="text-xs font-semibold text-muted-foreground">
              Date
              <button
                type="button"
                onClick={() => dateRef.current?.showPicker()}
                className="mt-1 flex h-10 w-full cursor-pointer items-center rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/40"
              >
                <span className={`flex-1 text-left ${draft.date ? "text-foreground" : "text-muted-foreground"}`}>
                  {draft.date ? formatDate(draft.date) : "Select date"}
                </span>
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <input
                ref={dateRef}
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                tabIndex={-1}
                className="sr-only"
              />
            </div>
            <label className="block text-xs font-semibold text-muted-foreground">
              Amount
              <AmountInput
                min={0}
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                placeholder="0.00"
                className="mt-1 h-10 rounded-lg"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Memo <span className="font-normal text-muted-foreground">(optional)</span>
              <Input
                value={draft.memo}
                onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
                placeholder="Optional note"
                className="mt-1 h-10 rounded-lg"
                maxLength={800}
              />
            </label>
            <Button
              type="submit"
              variant="prominent"
              className="w-full"
              disabled={isCreating}
            >
              {isCreating ? "Saving\u2026" : eventType === "fund_foundation" ? "Record Funding" : "Record Transfer"}
            </Button>
          </form>
        </ResponsiveModalContent>
      ) : null}
    </ResponsiveModal>
  );
});
