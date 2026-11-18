"use client";

import { useCallback } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/lib/types";

/**
 * Client-side navigations since this document loaded. Module state resets on a
 * full page load, so a page opened straight from an email or a shared link
 * starts at zero and "back" falls back to the home page instead of leaving the
 * app.
 */
let inAppNavigations = 0;

/** Called by the route-change listener on every client-side navigation. */
export function recordInAppNavigation() {
  inAppNavigations += 1;
}

function canGoBackInApp() {
  return inAppNavigations > 0 && window.history.length > 1;
}

/** The page a role starts from, matching where sign-in sends them. */
export function homePathFor(role: AppRole, isMobile: boolean): Route {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/dashboard";
  if (isMobile) return "/mobile";
  return role === "member" ? "/workspace" : "/dashboard";
}

/**
 * Returns a handler that goes back within the app, or to `fallback` when there
 * is nowhere to go back to. `fallback` may be a function so device checks run
 * at click time rather than during render.
 */
export function useBackNavigation(fallback: Route | (() => Route)) {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBackInApp()) {
      router.back();
      return;
    }
    router.push(typeof fallback === "function" ? fallback() : fallback);
  }, [router, fallback]);
}
