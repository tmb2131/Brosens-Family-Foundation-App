"use client";

import { useEffect } from "react";
import { useSeedProfile } from "@/components/auth/auth-provider";
import type { UserProfile } from "@/lib/types";

/**
 * Bridge component: receives a server-fetched profile and pushes it into
 * AuthProvider so the client skips the redundant GET /api/auth/me round-trip.
 * Renders nothing — it only exists for the side-effect.
 */
export function ServerAuthSeed({ profile }: { profile: UserProfile }) {
  const seedProfile = useSeedProfile();

  useEffect(() => {
    seedProfile?.(profile);
  }, [seedProfile, profile]);

  return null;
}
