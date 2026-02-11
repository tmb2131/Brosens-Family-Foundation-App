import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getWorkspaceSnapshot } from "@/lib/foundation-data";
import { toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const snapshot = await getWorkspaceSnapshot(admin, profile);
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
