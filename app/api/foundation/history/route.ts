import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { fetchFoundationPageData, buildHistoryFromData } from "@/lib/foundation-data";
import { STALE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin } = await requireAuthContext();
    const pageData = await fetchFoundationPageData(admin);
    const historyByYear = buildHistoryFromData(pageData);
    return NextResponse.json({ historyByYear }, { headers: STALE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
