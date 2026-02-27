"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, CardLabel } from "@/components/ui/card";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  className,
  children
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <GlassCard className={cn("overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg -m-1 p-1"
        aria-expanded={open}
      >
        <CardLabel className="mb-0">{title}</CardLabel>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </GlassCard>
  );
}
