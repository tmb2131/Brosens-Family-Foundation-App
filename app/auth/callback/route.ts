import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

/** Reason codes handed to the auth pages via `?error=`. */
const ERROR_EXPIRED = "expired_or_invalid";
/** PKCE links only work in the browser that requested them — worth saying so. */
const ERROR_OTHER_BROWSER = "other_browser";

const DEFAULT_NEXT = "/reset-password";

const ALLOWED_OTP_TYPES: ReadonlySet<string> = new Set<EmailOtpType>([
  "recovery",
  "magiclink",
  "invite",
  "signup",
  "email",
  "email_change"
]);

/**
 * Returns `value` only when it is a path that stays on this origin.
 *
 * A leading `//`, a backslash, or embedded whitespace are all re-read as an
 * authority by the URL parser (`/\evil.com` resolves to `https://evil.com/`),
 * so each is rejected before the value is used as a redirect target.
 */
function safeInternalPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (/[\\\s]|[\u0000-\u001f\u007f]/.test(value)) return null;

  const probeOrigin = "https://internal.invalid";
  let resolved: URL;
  try {
    resolved = new URL(value, probeOrigin);
  } catch {
    return null;
  }

  if (resolved.origin !== probeOrigin) return null;
  return `${resolved.pathname}${resolved.search}`;
}

function buildRedirect(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

/**
 * Supabase reports a missing/mismatched PKCE verifier as a code-verifier error.
 * That means the link was opened somewhere other than the browser that asked
 * for it, which is a different problem from an expired token.
 */
function isMissingCodeVerifier(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("code verifier") || normalized.includes("code_verifier");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextPath = safeInternalPath(searchParams.get("next")) ?? DEFAULT_NEXT;

  const failure = (reason: string) => buildRedirect(request, `/forgot-password?error=${reason}`);

  // Supabase appends its own error params when the link itself is rejected
  // (expired one-time token, already-used link, disabled user).
  if (searchParams.get("error") || searchParams.get("error_code")) {
    return failure(ERROR_EXPIRED);
  }

  const supabase = await createServerClient();
  if (!supabase) {
    return failure(ERROR_EXPIRED);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return buildRedirect(request, nextPath);
    }

    return failure(isMissingCodeVerifier(error.message) ? ERROR_OTHER_BROWSER : ERROR_EXPIRED);
  }

  if (tokenHash && type && ALLOWED_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash
    });
    if (!error) {
      return buildRedirect(request, nextPath);
    }

    return failure(ERROR_EXPIRED);
  }

  return failure(ERROR_EXPIRED);
}
