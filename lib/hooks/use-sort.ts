"use client";

import { useCallback, useRef, useState } from "react";

export type SortDirection = "asc" | "desc";

interface UseSortOptions<K extends string> {
  /** Called when switching to a new key to determine initial direction. Defaults to "asc". */
  getDefaultDirection?: (key: K) => SortDirection;
}

export function useSort<K extends string>(
  initialKey: K,
  initialDirection: SortDirection = "asc",
  options?: UseSortOptions<K>
) {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);
  const getDefaultDirectionRef = useRef(options?.getDefaultDirection);
  getDefaultDirectionRef.current = options?.getDefaultDirection;

  const toggleSort = useCallback((nextKey: K) => {
    setSortKey((currentKey) => {
      if (currentKey === nextKey) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDirection(getDefaultDirectionRef.current?.(nextKey) ?? "asc");
      return nextKey;
    });
  }, []);

  return { sortKey, sortDirection, toggleSort } as const;
}
