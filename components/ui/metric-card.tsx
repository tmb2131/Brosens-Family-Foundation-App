import type { PropsWithChildren, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricTone = "emerald" | "sky" | "indigo" | "amber";

const toneClasses: Record<MetricTone, { border: string; icon: string }> = {
  emerald: {
    border: "border-l-emerald-500 dark:border-l-emerald-400",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
  },
  sky: {
    border: "border-l-sky-500 dark:border-l-sky-400",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  },
  indigo: {
    border: "border-l-indigo-500 dark:border-l-indigo-400",
    icon: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
  },
  amber: {
    border: "border-l-amber-500 dark:border-l-amber-400",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
  }
};

interface MetricCardProps extends PropsWithChildren {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: MetricTone;
  className?: string;
  valueClassName?: string;
  subtitle?: ReactNode;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  tone = "emerald",
  className,
  valueClassName,
  subtitle,
  children
}: MetricCardProps) {
  const toneClass = toneClasses[tone];

  return (
    <Card className={cn("border-l-[3px]", toneClass.border, className)}>
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", toneClass.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <CardTitle>{title}</CardTitle>
      </div>
      <CardValue className={cn("metric-value-prominent", valueClassName)}>{value}</CardValue>
      {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
      {children}
    </Card>
  );
}
