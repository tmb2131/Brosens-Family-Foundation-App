import { cache, mutate } from "swr/_internal";

type SwrCacheRecord<T> = {
  _k?: unknown;
  data?: T;
};

type OptimisticTarget = string | ((key: unknown) => boolean);

type OptimisticMutation = {
  key: OptimisticTarget;
  updater: (current: any) => any;
};

type MatchedCacheEntry<T> = {
  cacheKey: string;
  key: string;
  previousData: T;
  nextData: T;
};

const FOUNDATION_KEY_MATCHER = (key: unknown) =>
  typeof key === "string" && key.startsWith("/api/foundation");

function getCacheRecord<T>(cacheKey: string) {
  return cache.get(cacheKey) as SwrCacheRecord<T> | undefined;
}

function collectMatchingEntries<T>(
  target: OptimisticTarget,
  updater: (current: T) => T,
): MatchedCacheEntry<T>[] {
  if (typeof target === "string") {
    const record = getCacheRecord<T>(target);
    if (record?.data === undefined) return [];
    return [
      {
        cacheKey: target,
        key: target,
        previousData: record.data,
        nextData: updater(record.data),
      },
    ];
  }

  const matches: MatchedCacheEntry<T>[] = [];
  for (const cacheKey of cache.keys()) {
    if (/^\$(inf|sub)\$/.test(cacheKey)) continue;
    const record = getCacheRecord<T>(cacheKey);
    if (record?.data === undefined || typeof record._k !== "string" || !target(record._k)) {
      continue;
    }
    matches.push({
      cacheKey,
      key: record._k,
      previousData: record.data,
      nextData: updater(record.data),
    });
  }
  return matches;
}

async function setEntries<T>(entries: MatchedCacheEntry<T>[], field: "nextData" | "previousData") {
  await Promise.all(
    entries.map((entry) =>
      mutate<T>(entry.key, entry[field], {
        populateCache: true,
        revalidate: false,
      }),
    ),
  );
}

async function revalidateTarget(target: OptimisticTarget) {
  await mutate(target as string | ((key: unknown) => boolean));
}

/**
 * Invalidate all SWR keys starting with `/api/foundation`.
 * SWR's `mutate(string)` only matches exact keys, so parameterized keys
 * like `/api/foundation?budgetYear=2025` would be missed. This helper
 * uses the filter-function overload to catch them all.
 */
export function mutateAllFoundation() {
  return mutate(FOUNDATION_KEY_MATCHER);
}

/**
 * Run a mutation with an optimistic cache update and automatic rollback on error.
 *
 * 1. Immediately applies `updater` to the cached value for `key`.
 * 2. Runs `fetcher` exactly once.
 * 3. On success, revalidates so the server-authoritative data replaces the optimistic value.
 * 4. On error, restores the pre-optimistic cache state.
 */
export async function optimisticMutate<T>(
  key: string,
  fetcher: () => Promise<unknown>,
  updater: (current: T) => T,
): Promise<void> {
  const entries = collectMatchingEntries(key, updater);
  if (entries.length > 0) {
    await setEntries(entries, "nextData");
  }

  try {
    await fetcher();
  } catch (error) {
    if (entries.length > 0) {
      await setEntries(entries, "previousData");
    }
    throw error;
  }

  await revalidateTarget(key);
}

/**
 * Optimistically update all cached `/api/foundation*` keys (parameterized variants)
 * with the same updater, then revalidate after the fetcher resolves.
 */
export function optimisticMutateAllFoundation<T>(
  fetcher: () => Promise<unknown>,
  updater: (current: T) => T,
): Promise<void> {
  return optimisticMutateMany([{ key: FOUNDATION_KEY_MATCHER, updater }], fetcher);
}

/**
 * Apply multiple optimistic cache updates while performing one network mutation.
 * Each affected key rolls back if the fetcher fails, then all targets revalidate.
 */
export async function optimisticMutateMany(
  mutations: OptimisticMutation[],
  fetcher: () => Promise<unknown>,
): Promise<void> {
  const entriesByCacheKey = new Map<string, MatchedCacheEntry<unknown>>();

  for (const mutation of mutations) {
    const matchedEntries = collectMatchingEntries(mutation.key, mutation.updater);
    for (const entry of matchedEntries) {
      const existing = entriesByCacheKey.get(entry.cacheKey);
      if (existing) {
        const nextData = mutation.updater(existing.nextData);
        entriesByCacheKey.set(entry.cacheKey, {
          ...existing,
          nextData,
        });
        continue;
      }
      entriesByCacheKey.set(entry.cacheKey, entry);
    }
  }

  const entries = [...entriesByCacheKey.values()];
  if (entries.length > 0) {
    await setEntries(entries, "nextData");
  }

  try {
    await fetcher();
  } catch (error) {
    if (entries.length > 0) {
      await setEntries(entries, "previousData");
    }
    throw error;
  }

  await Promise.all(mutations.map((mutation) => revalidateTarget(mutation.key)));
}
