const PERF_PREFIX = "[perf]";

function formatMs(ms: number): string {
  return ms < 1 ? "<1ms" : `${Math.round(ms)}ms`;
}

function now(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export { PERF_PREFIX, formatMs, now };

export interface PerfTimer {
  step(label: string): void;
  done(): void;
}

/**
 * Start a named page-load timer for server-side rendering.
 * Uses console.info which survives production builds (excluded from removeConsole).
 */
export function startPagePerf(pageName: string): PerfTimer {
  const t0 = now();
  let lastStep = t0;
  const steps: Array<{ label: string; stepMs: number; totalMs: number }> = [];

  return {
    step(label: string) {
      const current = now();
      const stepMs = current - lastStep;
      const totalMs = current - t0;
      steps.push({ label, stepMs, totalMs });
      console.info(
        `${PERF_PREFIX} ${pageName} │ ${label} ${formatMs(stepMs)} (total ${formatMs(totalMs)})`
      );
      lastStep = current;
    },

    done() {
      const totalMs = now() - t0;
      const summary = steps.map((s) => `${s.label}: ${formatMs(s.stepMs)}`).join(", ");
      console.info(
        `${PERF_PREFIX} ${pageName} │ ✓ server done ${formatMs(totalMs)} [${summary}]`
      );
    },
  };
}
