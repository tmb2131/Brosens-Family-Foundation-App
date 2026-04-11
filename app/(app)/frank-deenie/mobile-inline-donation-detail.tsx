"use client";

import { useEffect, useRef, useState } from "react";

import { FrankDeenieDonationRow } from "@/lib/types";
import { DetailMode, DonationDetailBody } from "./donation-detail-body";
import { ReturnCheckFormBody } from "./return-check-form-body";

type InlineMode = DetailMode | "return-check";

interface MobileInlineDonationDetailProps {
  row: FrankDeenieDonationRow;
  expanded: boolean;
  isAdmin: boolean;
  readOnly?: boolean;
  deletingRowId: string | null;
  initialMode: DetailMode;
  onClose: () => void;
  onMutate: () => void;
  onRequestDelete: (row: FrankDeenieDonationRow) => void;
  onViewHistory: (name: string) => void;
}

export function MobileInlineDonationDetail({
  row,
  expanded,
  isAdmin,
  readOnly,
  deletingRowId,
  initialMode,
  onClose,
  onMutate,
  onRequestDelete,
  onViewHistory,
}: MobileInlineDonationDetailProps) {
  const [inlineMode, setInlineMode] = useState<InlineMode>(initialMode);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset inline mode when the detail is expanded fresh or the row changes
  useEffect(() => {
    if (expanded) {
      setInlineMode(initialMode);
    }
  }, [expanded, initialMode, row.id]);

  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 320);
    return () => clearTimeout(timer);
  }, [expanded, inlineMode]);

  const handleBeginReturn = () => {
    setInlineMode("return-check");
  };

  const handleReturnCancel = () => {
    setInlineMode("view");
  };

  const handleReturnSuccess = () => {
    setInlineMode("view");
    onMutate();
  };

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      <div className="min-h-0 overflow-hidden">
        <div ref={containerRef} className="mt-3 border-t border-border/60 pt-3">
          {inlineMode === "return-check" ? (
            <ReturnCheckFormBody
              row={row}
              resetKey={row.id}
              onReturned={handleReturnSuccess}
              onCancel={handleReturnCancel}
              renderInlineActions
            />
          ) : (
            <DonationDetailBody
              row={row}
              isAdmin={isAdmin}
              readOnly={readOnly}
              deletingRowId={deletingRowId}
              initialMode={inlineMode as DetailMode}
              resetKey={`${row.id}:${inlineMode}`}
              onClose={onClose}
              onMutate={onMutate}
              onBeginReturn={handleBeginReturn}
              onRequestDelete={onRequestDelete}
              onViewHistory={onViewHistory}
              showCloseButton={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
