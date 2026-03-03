import { NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { runCharityNavigatorScoreBackfill } from "@/lib/charity-navigator";

export async function POST() {
  try {
    const context = await requireAuthContext();
    assertRole(context.profile, ["oversight"]);

    const result = await runCharityNavigatorScoreBackfill(context.admin);
    if (result.configMissing) {
      return NextResponse.json(
        { error: "CHARITY_NAVIGATOR_API_KEY is not configured on the server." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
