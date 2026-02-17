"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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

  // Intercept click events on nav links to start the bar immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-nav-href]");
      if (!anchor) return;

      const href = anchor.getAttribute("data-nav-href");
      if (!href || href === prevPathname.current) return;

      // Start the progress bar
      setProgress(15);
      clearTimeout(timerRef.current);

      // Simulate incremental progress
      let current = 15;
      const tick = () => {
        current += Math.max(1, (85 - current) * 0.08);
        if (current < 85) {
          setProgress(current);
          timerRef.current = setTimeout(tick, 120);
        }
      };
      timerRef.current = setTimeout(tick, 120);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
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
