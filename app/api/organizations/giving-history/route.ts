import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getOrganizationGivingHistory } from "@/lib/organization-giving-history";
import { PRIVATE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAuthContext();
    const name = request.nextUrl.searchParams.get("name");
    const organizationId = request.nextUrl.searchParams.get("organizationId") || null;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name query parameter is required." }, { status: 400 });
    }

    const history = await getOrganizationGivingHistory(admin, {
      organizationId,
      name: name.trim()
    });

    return NextResponse.json(history, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
