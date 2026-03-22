"use client";

import { useEffect, useRef } from "react";
import { PERF_PREFIX, formatMs, now } from "@/lib/perf-logger";

const STALL_THRESHOLD_MS = 3_000;
const STALL_CHECK_INTERVAL_MS = 2_000;

/**
 * Client-side hook that logs time-to-mount and time-to-content for a page.
 * Place in the top-level client component that receives server data.
 *
 * @param pageName - Route label for log output (e.g. "/dashboard")
 * @param isReady  - Pass `!isLoading` from SWR so "content ready" fires
 *                   when data actually arrives and skeletons disappear.
 * @param debugState - Optional object with SWR state for stall diagnostics.
 */
export function usePagePerf(
  pageName: string,
  isReady: boolean = true,
  debugState?: Record<string, unknown>
) {
  const loggedMount = useRef(false);
  const loggedReady = useRef(false);
  const componentCreatedAt = useRef(now());
  const debugStateRef = useRef(debugState);
  debugStateRef.current = debugState;

  useEffect(() => {
    if (loggedMount.current) return;
    loggedMount.current = true;
    const hydrateMs = now() - componentCreatedAt.current;
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

  useEffect(() => {
    if (isReady) return;

    const t0 = componentCreatedAt.current;
    let warned = false;

    const interval = setInterval(() => {
      const elapsed = now() - t0;
      if (elapsed > STALL_THRESHOLD_MS && !loggedReady.current) {
        const state = debugStateRef.current;
        const stateStr = state
          ? " " + Object.entries(state).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")
          : "";
        if (!warned) {
          console.info(
            `${PERF_PREFIX} ${pageName} │ ⚠ stalled at ${formatMs(elapsed)} — still loading.${stateStr}`
          );
          warned = true;
        } else {
          console.info(
            `${PERF_PREFIX} ${pageName} │ ⚠ still loading at ${formatMs(elapsed)}.${stateStr}`
          );
        }
      }
    }, STALL_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pageName, isReady]);
}
