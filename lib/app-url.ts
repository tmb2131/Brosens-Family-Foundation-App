/**
 * Resolves the application's public base URL from the environment.
 *
 * Returns an origin with a trailing slash (e.g. `https://brosensfoundation.com/`)
 * so it can be used directly as a base for `new URL(path, base)`, or `null`
 * when no usable value is configured — callers then fall back to relative paths.
 */
export function getAppBaseUrl(): string | null {
  // Ordered most to least authoritative. The two Vercel values are both bare
  // hostnames, so they need a scheme.
  //
  // VERCEL_PROJECT_PRODUCTION_URL (the project's stable production domain) is
  // preferred over VERCEL_URL (the per-deployment hostname) even on preview
  // deployments: emails built from a deployment URL break once that deployment
  // is superseded, and a canonical link-preview URL should point at production
  // regardless of which deployment rendered it. VERCEL_URL stays last so
  // environments that do not expose the production value still resolve.
  const baseUrlCandidates = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  ];

  for (const candidate of baseUrlCandidates) {
    const value = String(candidate ?? "").trim();
    if (!value) {
      continue;
    }

    try {
      const url = new URL(value);
      return `${url.origin}/`;
    } catch {
      continue;
    }
  }

  return null;
}

/** Absolute URL for an in-app path, or the path itself when no base URL is configured. */
export function withAppBase(path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    return safePath;
  }

  try {
    return new URL(safePath, baseUrl).toString();
  } catch {
    return safePath;
  }
}
