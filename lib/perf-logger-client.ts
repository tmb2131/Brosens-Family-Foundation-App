"use client";

import { useEffect, useRef } from "react";
import { PERF_PREFIX, formatMs, now } from "@/lib/perf-logger";

/**
 * Client-side hook that logs time-to-mount and time-to-content for a page.
 * Place in the top-level client component that receives server data.
 *
 * - "mounted" fires on first useEffect (after hydration/render commit).
 * - "content ready" fires when `isReady` flips to true (e.g. SWR data loaded).
 *   If the server provides fallbackData and content is already available at mount,
 *   both fire together.
 */
export function usePagePerf(pageName: string, isReady: boolean = true) {
  const mountedAt = useRef<number | null>(null);
  const loggedMount = useRef(false);
  const loggedReady = useRef(false);
  const componentCreatedAt = useRef(now());

  useEffect(() => {
    if (loggedMount.current) return;
    loggedMount.current = true;
    mountedAt.current = now();
    const hydrateMs = mountedAt.current - componentCreatedAt.current;
    console.info(
      `${PERF_PREFIX} ${pageName} │ client mounted ${formatMs(hydrateMs)} after component create`
    );
  }, [pageName]);

  useEffect(() => {
    if (!isReady || loggedReady.current) return;
    loggedReady.current = true;
    const readyMs = now() - componentCreatedAt.current;
    console.info(
      `${PERF_PREFIX} ${pageName} │ ✓ content ready ${formatMs(readyMs)} after component create`
    );
  }, [pageName, isReady]);
}
