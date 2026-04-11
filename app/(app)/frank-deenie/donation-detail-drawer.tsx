"use client";

import { memo } from "react";

import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { FrankDeenieDonationRow } from "@/lib/types";
import { DonationDetailBody, DetailMode } from "./donation-detail-body";

export type { DetailMode };

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
  return (
    <ResponsiveModal open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      {row ? (
        <ResponsiveModalContent
          aria-labelledby="donation-details-title"
          dialogClassName="max-w-3xl rounded-3xl p-4 sm:p-5"
          showCloseButton={false}
        >
          <DonationDetailBody
            row={row}
            isAdmin={isAdmin}
            readOnly={readOnly}
            deletingRowId={deletingRowId}
            initialMode={initialMode}
            resetKey={`${row.id}:${initialMode}`}
            onClose={onClose}
            onMutate={onMutate}
            onBeginReturn={onBeginReturn}
            onRequestDelete={onRequestDelete}
            onViewHistory={onViewHistory}
          />
        </ResponsiveModalContent>
      ) : null}
    </ResponsiveModal>
  );
});
