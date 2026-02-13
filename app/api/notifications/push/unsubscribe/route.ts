import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { deactivatePushSubscription } from "@/lib/push-notifications";

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const endpoint = String(body.endpoint ?? "").trim() || undefined;

    await deactivatePushSubscription(admin, profile.id, endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
