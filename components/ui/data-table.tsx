import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function DataTableHeadRow({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <tr className={cn("data-table-head-row", className)}>{children}</tr>;
}

export function DataTableRow({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return <tr className={cn("data-table-row", className)}>{children}</tr>;
}

export function DataTableSortButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn("data-table-sort-button", className)} {...props}>
      {children}
    </button>
  );
}
