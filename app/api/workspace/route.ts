import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getWorkspaceSnapshot } from "@/lib/foundation-data";
import { PRIVATE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const snapshot = await getWorkspaceSnapshot(admin, profile);
    return NextResponse.json(snapshot, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
