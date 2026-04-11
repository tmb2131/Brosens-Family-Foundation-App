"use client";

import { useEffect, useRef } from "react";

import { AddDonationFormBody } from "./add-donation-form-body";

interface MobileInlineAddDonationProps {
  expanded: boolean;
  selectedYear: number | null;
  nameSuggestions: string[];
  onCreated: () => void;
  onCancel: () => void;
}

export function MobileInlineAddDonation({
  expanded,
  selectedYear,
  nameSuggestions,
  onCreated,
  onCancel,
}: MobileInlineAddDonationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 320);
    return () => clearTimeout(timer);
  }, [expanded]);

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          ref={containerRef}
          className="mt-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
        >
          <h3 className="text-base font-bold">Add Donation</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a new ledger entry for the selected period.
          </p>
          <div className="mt-3">
            <AddDonationFormBody
              resetKey={expanded ? "open" : "closed"}
              selectedYear={selectedYear}
              nameSuggestions={nameSuggestions}
              onCreated={onCreated}
              onCancel={onCancel}
              renderInlineActions
            />
          </div>
        </div>
      </div>
    </div>
  );
}
