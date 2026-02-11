import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("glass-card rounded-2xl p-4", className)}>{children}</section>;
}

export function CardTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h3 className={cn("text-sm uppercase tracking-wide text-zinc-500", className)}>{children}</h3>;
}

export function CardValue({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <p className={cn("mt-1 text-xl font-semibold", className)}>{children}</p>;
}
