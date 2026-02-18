"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";

export function LastAccessedTouch() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) {
      return;
    }
    fetch("/api/auth/touch", { method: "POST" }).catch(() => {
      // Fire-and-forget; ignore errors (e.g. network)
    });
  }, [loading, user?.id]);

  return null;
}
