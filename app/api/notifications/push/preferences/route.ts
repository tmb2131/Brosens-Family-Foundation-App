import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import {
  getNotificationPreferences,
  getPublicVapidKey,
  isPushConfigured,
  updateNotificationPreferences
} from "@/lib/push-notifications";

function parseOptionalBoolean(
  payload: Record<string, unknown>,
  key: string
): boolean | undefined {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return undefined;
  }

  const value = payload[key];
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${key} must be a boolean.`);
  }

  return value;
}

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const settings = await getNotificationPreferences(admin, profile.id);

    return NextResponse.json({
      ...settings,
      vapidPublicKey: getPublicVapidKey(),
      pushConfigured: isPushConfigured()
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const preferences = await updateNotificationPreferences(admin, profile.id, {
      pushEnabled: parseOptionalBoolean(body, "pushEnabled"),
      proposalCreated: parseOptionalBoolean(body, "proposalCreated"),
      proposalReadyForMeeting: parseOptionalBoolean(body, "proposalReadyForMeeting"),
      proposalStatusChanged: parseOptionalBoolean(body, "proposalStatusChanged"),
      policyUpdatePublished: parseOptionalBoolean(body, "policyUpdatePublished"),
      proposalApprovedForAdmin: parseOptionalBoolean(body, "proposalApprovedForAdmin")
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
