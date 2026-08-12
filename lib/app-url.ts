/**
 * Resolves the application's public base URL from the environment.
 *
 * Returns an origin with a trailing slash (e.g. `https://brosensfoundation.com/`)
 * so it can be used directly as a base for `new URL(path, base)`, or `null`
 * when no usable value is configured — callers then fall back to relative paths.
 */
export function getAppBaseUrl(): string | null {
  const baseUrlCandidates = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
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
