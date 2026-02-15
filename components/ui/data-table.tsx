import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function DataTableHeadRow({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <tr className={cn("border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-400 dark:border-zinc-700 dark:text-zinc-500", className)}>{children}</tr>;
}

export function DataTableRow({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <tr className={cn("border-b align-top transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40", className)}>{children}</tr>;
}

export function DataTableSortButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn("font-semibold transition-colors hover:text-zinc-700 dark:hover:text-zinc-300", className)} {...props}>
      {children}
    </button>
  );
}
