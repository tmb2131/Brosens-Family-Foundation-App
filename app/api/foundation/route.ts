import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getFoundationSnapshot } from "@/lib/foundation-data";
import { toErrorResponse } from "@/lib/http-error";

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const budgetYearParam = request.nextUrl.searchParams.get("budgetYear");
    const allYearsParam = request.nextUrl.searchParams.get("allYears");
    const includeHistoryParam = request.nextUrl.searchParams.get("includeHistory");
    const budgetYear = budgetYearParam ? Number(budgetYearParam) : undefined;
    const includeAllYears = allYearsParam === "1" || allYearsParam === "true";
    const includeHistory = includeHistoryParam === "1" || includeHistoryParam === "true";
    const snapshot = await getFoundationSnapshot(
      admin,
      profile.id,
      budgetYear,
      includeAllYears,
      includeHistory
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
