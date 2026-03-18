import { NextResponse } from "next/server";
import { requireAuthContext, assertRole } from "@/lib/auth-server";
import { listDonationNameSuggestions } from "@/lib/frank-deenie-data";
import { STALE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { profile, admin } = await requireAuthContext();
    assertRole(profile, ["oversight", "admin", "manager"]);
    const names = await listDonationNameSuggestions(admin);

    return NextResponse.json({ names }, { headers: STALE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
