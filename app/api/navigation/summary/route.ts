import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { getNavigationSummary } from "@/lib/navigation-summary";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const summary = await getNavigationSummary(admin, profile.id, profile.role);
    return NextResponse.json(summary);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
