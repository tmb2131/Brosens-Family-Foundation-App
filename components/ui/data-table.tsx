import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function DataTableHeadRow({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <tr className={cn("border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground", className)}>{children}</tr>;
}

export function DataTableRow({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <tr className={cn("border-b align-top transition-colors hover:bg-muted/60", className)}>{children}</tr>;
}

export function DataTableSortButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn("font-semibold transition-colors hover:text-foreground", className)} {...props}>
      {children}
    </button>
  );
}
