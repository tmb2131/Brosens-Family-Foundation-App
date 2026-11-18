"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordInAppNavigation } from "@/lib/back-navigation";

/**
 * Scrolls to the top of the page when the route changes.
 * Handles both window scroll and the main content scroll container (mobile sticky nav).
 * Also counts client-side navigations so "Back" buttons know whether there is an
 * in-app page to return to.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      recordInAppNavigation();
    }
    window.scrollTo(0, 0);
    const mainScroll = document.querySelector("[data-main-scroll]");
    if (mainScroll) {
      mainScroll.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
