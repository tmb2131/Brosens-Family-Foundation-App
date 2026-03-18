import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { deleteFoundationEvent } from "@/lib/frank-deenie-data";
import { toErrorResponse } from "@/lib/http-error";

const ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;

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
