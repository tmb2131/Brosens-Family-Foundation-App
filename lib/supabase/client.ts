"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Port-specific auth cookie name so multiple dev instances (e.g. 3000, 3001) don't share the same session. */
function getAuthCookieName(): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.location.hostname !== "localhost" || !window.location.port) return undefined;
  if (window.location.port === "3000") return undefined;
  return `sb-auth-token-${window.location.port}`;
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  const cookieName = getAuthCookieName();
  return createBrowserClient(url, key, cookieName ? { cookieOptions: { name: cookieName } } : undefined);
}
