import { NextRequest, NextResponse } from "next/server";
import { shouldUseMobileHome } from "@/lib/device-detection";

/** `/proposals/<uuid>` — the standalone proposal page, which is mobile-first already. */
const PROPOSAL_DETAIL_PATH =
  /^\/proposals\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // A link to a single proposal is its own destination on every device — send
  // the visitor straight there instead of via the mobile home screen.
  const destination =
    isMobile && !PROPOSAL_DETAIL_PATH.test(targetPath)
      ? `/mobile?next=${encodeURIComponent(targetPath)}`
      : targetPath;

  return NextResponse.redirect(new URL(destination, request.url), { status: 307 });
}
