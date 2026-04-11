"use client";

import { memo } from "react";

import { ResponsiveModal, ResponsiveModalContent } from "@/components/ui/responsive-modal";
import { FoundationEvent, FoundationEventType } from "@/lib/types";
import { FoundationEventFormBody } from "./foundation-event-form-body";

interface FoundationEventFormProps {
  eventType: FoundationEventType | null;
  editingEvent?: FoundationEvent | null;
  onClose: () => void;
  onSaved: () => void;
}

export const FoundationEventForm = memo(function FoundationEventForm({
  eventType,
  editingEvent,
  onClose,
  onSaved,
}: FoundationEventFormProps) {
  const isEditing = !!editingEvent;
  const resolvedEventType = editingEvent?.eventType ?? eventType;
  const isOpen = !!resolvedEventType;

  const title = isEditing
    ? `Edit ${resolvedEventType === "fund_foundation" ? "Funding" : "Transfer"}`
    : resolvedEventType === "fund_foundation"
      ? "Fund Foundation"
      : "Transfer into Foundation";

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      {isOpen && resolvedEventType ? (
        <ResponsiveModalContent
          aria-labelledby="foundation-event-title"
          dialogClassName="max-w-md rounded-3xl p-4 sm:p-5"
          showCloseButton
        >
          <h2 id="foundation-event-title" className="text-base font-bold">
            {title}
          </h2>
          <div className="pt-2">
            <FoundationEventFormBody
              eventType={resolvedEventType}
              editingEvent={editingEvent}
              resetKey={isOpen ? `${resolvedEventType}:${editingEvent?.id ?? "new"}` : "closed"}
              onSaved={onSaved}
              onCancel={onClose}
            />
          </div>
        </ResponsiveModalContent>
      ) : null}
    </ResponsiveModal>
  );
});
