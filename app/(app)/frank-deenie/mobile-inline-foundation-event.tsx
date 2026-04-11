"use client";

import { useEffect, useRef } from "react";

import { FoundationEvent, FoundationEventType } from "@/lib/types";
import { FoundationEventFormBody } from "./foundation-event-form-body";

interface MobileInlineFoundationEventProps {
  expanded: boolean;
  eventType: FoundationEventType | null;
  editingEvent?: FoundationEvent | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function MobileInlineFoundationEvent({
  expanded,
  eventType,
  editingEvent,
  onSaved,
  onCancel,
}: MobileInlineFoundationEventProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedEventType = editingEvent?.eventType ?? eventType;

  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 320);
    return () => clearTimeout(timer);
  }, [expanded]);

  const isEditing = !!editingEvent;
  const title = isEditing
    ? `Edit ${resolvedEventType === "fund_foundation" ? "Funding" : "Transfer"}`
    : resolvedEventType === "fund_foundation"
      ? "Fund Foundation"
      : resolvedEventType === "transfer_to_foundation"
        ? "Transfer into Foundation"
        : "";

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
          {resolvedEventType ? (
            <>
              <h3 className="text-base font-bold">{title}</h3>
              <div className="mt-3">
                <FoundationEventFormBody
                  eventType={resolvedEventType}
                  editingEvent={editingEvent}
                  resetKey={expanded ? `${resolvedEventType}:${editingEvent?.id ?? "new"}` : "closed"}
                  onSaved={onSaved}
                  onCancel={onCancel}
                  renderInlineActions
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
