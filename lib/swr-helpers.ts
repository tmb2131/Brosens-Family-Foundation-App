import { mutate } from "swr";

/**
 * Invalidate all SWR keys starting with `/api/foundation`.
 * SWR's `mutate(string)` only matches exact keys, so parameterized keys
 * like `/api/foundation?budgetYear=2025` would be missed. This helper
 * uses the filter-function overload to catch them all.
 */
export function mutateAllFoundation() {
  void mutate(
    (key) => typeof key === "string" && key.startsWith("/api/foundation")
  );
}
