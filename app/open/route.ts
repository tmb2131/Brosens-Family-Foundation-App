import { NextRequest, NextResponse } from "next/server";

const MOBILE_UA_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

function sanitizeTargetPath(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export function GET(request: NextRequest) {
  const targetPath = sanitizeTargetPath(request.nextUrl.searchParams.get("to"));
  const userAgent = request.headers.get("user-agent") ?? "";
  const isMobile = MOBILE_UA_PATTERN.test(userAgent);

  const destination = isMobile
    ? `/mobile?next=${encodeURIComponent(targetPath)}`
    : targetPath;

  return NextResponse.redirect(new URL(destination, request.url), { status: 307 });
}
