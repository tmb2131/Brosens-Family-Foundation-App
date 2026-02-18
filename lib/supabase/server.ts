import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Port-specific auth cookie name so multiple dev instances (e.g. 3000, 3001) don't share the same session. */
function getAuthCookieNameForPort(port: string | null): string | undefined {
  if (port && port !== "3000") return `sb-auth-token-${port}`;
  return undefined;
}

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const port = host.startsWith("localhost:") ? host.split(":")[1] ?? null : null;
  const cookieName = getAuthCookieNameForPort(port);

  return createServerClient(url, key, {
    ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
          });
        } catch {
          // Cookie modification is only allowed in Server Actions and Route Handlers.
          // When called from a Server Component (e.g. layout/page), skip setting so we don't throw.
          // Session will still be read correctly; refresh will apply on the next request that can set cookies.
        }
      }
    }
  });
}
