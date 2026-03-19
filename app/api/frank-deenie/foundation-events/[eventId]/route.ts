import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { deleteFoundationEvent, updateFoundationEvent } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { FoundationEventType } from "@/lib/types";

const ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;
const VALID_EVENT_TYPES: FoundationEventType[] = ["fund_foundation", "transfer_to_foundation"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...ALLOWED_ROLES]);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Request body must be a JSON object.");
    }

    const input: { eventType?: FoundationEventType; date?: string; amount?: number; memo?: string | null } = {};

    if (body.eventType !== undefined) {
      const eventType = String(body.eventType);
      if (!VALID_EVENT_TYPES.includes(eventType as FoundationEventType)) {
        throw new HttpError(400, "eventType must be fund_foundation or transfer_to_foundation.");
      }
      input.eventType = eventType as FoundationEventType;
    }

    if (body.date !== undefined) input.date = String(body.date);
    if (body.amount !== undefined) input.amount = Number(body.amount);
    if (Object.prototype.hasOwnProperty.call(body, "memo")) {
      input.memo = body.memo === undefined || body.memo === null ? null : String(body.memo);
    }

    const event = await updateFoundationEvent(admin, eventId, input);

    return NextResponse.json({ event });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...ALLOWED_ROLES]);

    await deleteFoundationEvent(admin, eventId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
