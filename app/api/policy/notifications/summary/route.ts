import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { getPendingPolicyNotificationCount } from "@/lib/policy-data";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const pendingCount = await getPendingPolicyNotificationCount(admin, profile.id, profile.role);
    return NextResponse.json({ pendingCount });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
