import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function FilterPanel({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("grid gap-3 rounded-xl border border-zinc-200/60 bg-zinc-50/50 p-3 dark:border-zinc-700/40 dark:bg-zinc-800/30", className)}>{children}</div>;
}
