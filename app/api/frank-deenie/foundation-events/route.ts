import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { createFoundationEvent } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { FoundationEventType } from "@/lib/types";

const ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;
const VALID_EVENT_TYPES: FoundationEventType[] = ["fund_foundation", "transfer_to_foundation"];

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...ALLOWED_ROLES]);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Request body must be a JSON object.");
    }

    const eventType = String(body.eventType ?? "");
    if (!VALID_EVENT_TYPES.includes(eventType as FoundationEventType)) {
      throw new HttpError(400, "eventType must be fund_foundation or transfer_to_foundation.");
    }

    if (!Object.prototype.hasOwnProperty.call(body, "date")) {
      throw new HttpError(400, "date is required.");
    }

    if (!Object.prototype.hasOwnProperty.call(body, "amount")) {
      throw new HttpError(400, "amount is required.");
    }

    const event = await createFoundationEvent(admin, {
      eventType: eventType as FoundationEventType,
      date: String(body.date ?? ""),
      amount: Number(body.amount),
      memo: body.memo === undefined || body.memo === null ? body.memo : String(body.memo),
      requesterId: profile.id,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
