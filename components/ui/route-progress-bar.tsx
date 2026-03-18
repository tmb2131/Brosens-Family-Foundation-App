"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A thin progress bar shown at the top of the viewport during route transitions.
 * Detects navigation by observing pathname changes and animates from 0 -> ~80%
 * while waiting, then quickly fills to 100% when the new page mounts.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<number | null>(null);
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (pathname === prevPathname.current) {
      return;
    }

    prevPathname.current = pathname;

    // New pathname arrived — fill to 100% then hide
    setProgress(100);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setProgress(null), 200);
  }, [pathname]);

  // Start the progress bar animation (shared by click handler and custom event)
  const startProgress = () => {
    setProgress(15);
    clearTimeout(timerRef.current);

    let current = 15;
    const tick = () => {
      current += Math.max(1, (85 - current) * 0.08);
      if (current < 85) {
        setProgress(current);
        timerRef.current = setTimeout(tick, 120);
      }
    };
    timerRef.current = setTimeout(tick, 120);
  };

  // Intercept click events on nav links to start the bar immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-nav-href]");
      if (!anchor) return;

      const href = anchor.getAttribute("data-nav-href");
      if (!href || href === prevPathname.current) return;

      startProgress();
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  // Listen for imperative "route-progress-start" events from mutation handlers
  useEffect(() => {
    function handleStart() {
      startProgress();
    }

    window.addEventListener("route-progress-start", handleStart);
    return () => window.removeEventListener("route-progress-start", handleStart);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  if (progress === null) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-[2.5px] pointer-events-none"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.4)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? "width 200ms ease-out"
            : "width 400ms cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      />
    </div>
  );
}

const SHOW_DELAY_MS = 300;

/**
 * Indeterminate shimmer bar shown during SWR background revalidation.
 * Sits one z-level below RouteProgressBar so route transitions always win.
 * A 300ms delay prevents flicker on fast networks.
 */
export function BackgroundRevalidationBar({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (active) {
      timerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    } else {
      setVisible(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [active]);

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-[99] h-[2.5px] pointer-events-none overflow-hidden transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="status"
      aria-live="polite"
    >
      {visible && <span className="sr-only">Refreshing data</span>}
      <div className="h-full w-1/3 motion-safe:animate-[revalidation-shimmer_1.4s_ease-in-out_infinite] bg-accent/50 shadow-[0_0_6px_hsl(var(--accent)/0.25)]" />
    </div>
  );
}
