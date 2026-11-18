"use client";

import { PropsWithChildren, useEffect } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

/** A same-origin path from `?next=`, or null. */
function safeNextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next")?.trim() ?? "";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
}

export function Guard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signedOut } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // After "Sign out", start fresh. After an expired session, come back to
      // this page (query string included) once signed in again.
      if (signedOut) {
        router.replace("/login");
        return;
      }
      const currentPath = `${pathname || "/dashboard"}${window.location.search}`;
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (pathname === "/mobile" && user.role === "admin") {
      router.replace((safeNextPath() ?? "/admin") as Route);
    }
  }, [loading, pathname, router, signedOut, user]);

  // Always render children — server components handle auth gating.
  // This effect is a safety net for expired sessions.
  return children;
}
