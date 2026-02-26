import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

const CALLBACK_ERROR = "expired_or_invalid";
const DEFAULT_NEXT = "/reset-password";

function isSafeInternalPath(value: string | null): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  return true;
}

function buildRedirect(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextPath = isSafeInternalPath(searchParams.get("next")) ? searchParams.get("next")! : DEFAULT_NEXT;
  const failurePath = `/forgot-password?error=${CALLBACK_ERROR}`;

  const supabase = await createServerClient();
  if (!supabase) {
    return buildRedirect(request, failurePath);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return buildRedirect(request, nextPath);
    }

    return buildRedirect(request, failurePath);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash
    });
    if (!error) {
      return buildRedirect(request, nextPath);
    }

    return buildRedirect(request, failurePath);
  }

  return buildRedirect(request, failurePath);
}
