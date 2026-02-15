import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-700/50",
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card rounded-2xl p-4", className)}>
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card rounded-2xl p-4", className)}>
      <Skeleton className="mb-3 h-4 w-1/4" />
      <div className="flex items-end gap-2 h-[180px] pt-4">
        <Skeleton className="h-[40%] flex-1 rounded-t-md rounded-b-none" />
        <Skeleton className="h-[65%] flex-1 rounded-t-md rounded-b-none" />
        <Skeleton className="h-[80%] flex-1 rounded-t-md rounded-b-none" />
        <Skeleton className="h-[55%] flex-1 rounded-t-md rounded-b-none" />
        <Skeleton className="h-[70%] flex-1 rounded-t-md rounded-b-none" />
      </div>
    </div>
  );
}
