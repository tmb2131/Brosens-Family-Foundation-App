/**
 * Port-specific auth cookie name so multiple dev instances (3000, 3001, …) do
 * not share one session.
 *
 * Shared by the server client and the middleware: if they disagreed, the
 * middleware would refresh a cookie nobody reads and dev sessions on the extra
 * ports would silently fail to stay signed in. Kept free of `next/headers` so
 * the edge middleware bundle can import it.
 */
export function getAuthCookieNameForHost(host: string | null | undefined): string | undefined {
  if (!host?.startsWith("localhost:")) {
    return undefined;
  }

  const port = host.split(":")[1] ?? null;
  return port && port !== "3000" ? `sb-auth-token-${port}` : undefined;
}
