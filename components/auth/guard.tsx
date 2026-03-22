"use client";

import { PropsWithChildren, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function Guard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`);
      return;
    }

    if (pathname === "/mobile" && user.role === "admin") {
      router.replace("/admin");
    }
  }, [loading, pathname, router, user]);

  // Always render children — server components handle auth gating.
  // This effect is a safety net for expired sessions.
  return children;
}
