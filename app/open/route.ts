import { NextRequest, NextResponse } from "next/server";
import { shouldUseMobileHome } from "@/lib/device-detection";

function sanitizeTargetPath(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export function GET(request: NextRequest) {
  const targetPath = sanitizeTargetPath(request.nextUrl.searchParams.get("to"));
  const isMobile = shouldUseMobileHome({
    userAgent: request.headers.get("user-agent"),
    clientHintMobile: request.headers.get("sec-ch-ua-mobile")
  });

  const destination = isMobile
    ? `/mobile?next=${encodeURIComponent(targetPath)}`
    : targetPath;

  return NextResponse.redirect(new URL(destination, request.url), { status: 307 });
}
