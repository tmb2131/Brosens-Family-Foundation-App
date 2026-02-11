import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}
