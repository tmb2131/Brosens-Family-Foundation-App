import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function FilterPanel({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("filters-panel", className)}>{children}</div>;
}
