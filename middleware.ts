import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAuthCookieNameForHost } from "@/lib/supabase/cookie-name";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "on",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; "),
};

const STATIC_ASSET_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
};

/**
 * Persists a rotated Supabase session.
 *
 * A Server Component cannot write cookies, so `lib/supabase/server.ts` has to
 * swallow the write when a page render happens to be the thing that refreshes an
 * expired access token — the new tokens are then thrown away, and the next
 * request retries the refresh with a refresh token the server has already spent.
 * Past Supabase's reuse-detection window that revokes the session and signs the
 * member out mid-visit. Middleware runs before the render and *can* set cookies,
 * so doing the refresh here is what makes it stick.
 *
 * `getSession()` rather than `getUser()` on purpose: the only thing wanted here
 * is the refresh side effect, and `getSession()` reads the cookie locally and
 * calls the auth server only when the token has actually expired, instead of on
 * every navigation and prefetch. It is not used for any authorization decision —
 * those all go through `requireAuthContext()`, which verifies with `getUser()`.
 */
async function refreshSupabaseSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return;
  }

  const cookieName = getAuthCookieNameForHost(request.headers.get("host"));

  const supabase = createServerClient(url, anonKey, {
    ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>
      ) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(
            name,
            value,
            options as Parameters<typeof response.cookies.set>[2]
          );
        }
      }
    }
  });

  try {
    await supabase.auth.getSession();
  } catch {
    // A refresh failure is not a reason to fail the request: the page still
    // renders and `requireAuthContext()` will redirect to /login if the session
    // really is gone.
  }
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Expose the requested path to server components so page-level auth can send
  // an unauthenticated visitor back here after login (shareable deep links).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", `${url.pathname}${url.search}`);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  if (url.pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$/)) {
    for (const [key, value] of Object.entries(STATIC_ASSET_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  // Route handlers can set cookies themselves, so they persist their own
  // refresh and need nothing here. /auth/callback is skipped so the refresh
  // cannot race the code-for-session exchange that route performs.
  if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/auth/")) {
    await refreshSupabaseSession(request, response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sw.js, manifest
     *
     * API routes are included so JSON responses also carry the security
     * headers (nosniff in particular); the session refresh above skips them.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest).*)",
  ],
};
