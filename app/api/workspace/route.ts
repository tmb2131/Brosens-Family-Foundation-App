import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData,
  buildWorkspaceSnapshotFromData
} from "@/lib/foundation-data";
import { PRIVATE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
    const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
    const snapshot = buildWorkspaceSnapshotFromData(pageData, profile, foundation);
    return NextResponse.json(snapshot, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
