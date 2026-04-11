"use client";

import { memo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { AddDonationFormBody } from "./add-donation-form-body";

interface AddDonationFormProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number | null;
  nameSuggestions: string[];
  onCreated: () => void;
}

export const AddDonationForm = memo(function AddDonationForm({ open, onClose, selectedYear, nameSuggestions, onCreated }: AddDonationFormProps) {
  const [isCreating, setIsCreating] = useState(false);

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

        <div className="mt-4">
          <AddDonationFormBody
            resetKey={open ? "open" : "closed"}
            selectedYear={selectedYear}
            nameSuggestions={nameSuggestions}
            onCreated={onCreated}
            onCancel={handleClose}
            onSavingChange={setIsCreating}
          />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
});
