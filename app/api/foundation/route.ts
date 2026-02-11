import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getFoundationSnapshot } from "@/lib/foundation-data";
import { toErrorResponse } from "@/lib/http-error";

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const budgetYearParam = request.nextUrl.searchParams.get("budgetYear");
    const budgetYear = budgetYearParam ? Number(budgetYearParam) : undefined;
    const snapshot = await getFoundationSnapshot(admin, profile.id, budgetYear);
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
