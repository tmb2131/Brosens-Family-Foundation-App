"use client";

import { PropsWithChildren, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function Guard({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`);
      return;
    }

    // Admin on mobile should always land on Admin Queue; catch PWA restore / cached /mobile.
    if (pathname === "/mobile" && user.role === "admin") {
      router.replace("/admin");
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">
        Checking secure session...
      </div>
    );
  }

  return children;
}
