"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scrolls to the top of the page when the route changes.
 * Handles both window scroll and the main content scroll container (mobile sticky nav).
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
    const mainScroll = document.querySelector("[data-main-scroll]");
    if (mainScroll) {
      mainScroll.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
