import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { updatePolicyNotificationStatus } from "@/lib/policy-data";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    const body = await request.json();

    const action = String(body.action ?? "").trim();
    if (!["acknowledge", "flag"].includes(action)) {
      throw new HttpError(400, "action must be 'acknowledge' or 'flag'.");
    }

    const reason = body.reason === undefined ? undefined : String(body.reason ?? "");

    const result = await updatePolicyNotificationStatus(admin, {
      notificationId,
      userId: profile.id,
      action: action as "acknowledge" | "flag",
      reason
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
