import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getFoundationHistory } from "@/lib/foundation-data";
import { toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin } = await requireAuthContext();
    const historyByYear = await getFoundationHistory(admin);
    return NextResponse.json({ historyByYear });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
