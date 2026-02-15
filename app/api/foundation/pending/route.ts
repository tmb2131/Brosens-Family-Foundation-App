import { NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { getPendingProposalsForOversight } from "@/lib/foundation-data";
import { PRIVATE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["oversight"]);

    const proposals = await getPendingProposalsForOversight(admin, profile.id);
    return NextResponse.json({ proposals }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
