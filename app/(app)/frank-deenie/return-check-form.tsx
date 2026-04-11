"use client";

import { memo, useState } from "react";

import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { FrankDeenieDonationRow } from "@/lib/types";
import { ReturnCheckFormBody } from "./return-check-form-body";

interface ReturnCheckFormProps {
  row: FrankDeenieDonationRow | null;
  onClose: () => void;
  onReturned: () => void;
}

export const ReturnCheckForm = memo(function ReturnCheckForm({ row, onClose, onReturned }: ReturnCheckFormProps) {
  const [isReturning, setIsReturning] = useState(false);

  const handleClose = () => {
    if (!isReturning) onClose();
  };

  return (
    <ResponsiveModal
      open={row !== null}
      onOpenChange={(open) => { if (!open) handleClose(); }}
    >
      {row ? (
        <ResponsiveModalContent
          aria-labelledby="return-check-title"
          dialogClassName="max-w-md rounded-3xl p-5"
          showCloseButton={false}
          onInteractOutside={(e) => { if (isReturning) e.preventDefault(); }}
        >
          <ReturnCheckFormBody
            row={row}
            resetKey={row.id}
            onReturned={onReturned}
            onCancel={handleClose}
            onSavingChange={setIsReturning}
          />
        </ResponsiveModalContent>
      ) : null}
    </ResponsiveModal>
  );
});
