import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function FilterPanel({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("grid gap-3 rounded-xl border border-border/60 bg-muted/50 p-3", className)}>{children}</div>;
}
