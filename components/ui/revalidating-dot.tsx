"use client";

/**
 * Pulsing dot indicator shown next to page titles during SWR background
 * revalidation. Only renders when data already exists (not on initial load).
 */
export function RevalidatingDot({ isValidating, hasData }: { isValidating: boolean; hasData: boolean }) {
  if (!isValidating || !hasData) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
      <span className="sr-only">Refreshing</span>
    </span>
  );
}
