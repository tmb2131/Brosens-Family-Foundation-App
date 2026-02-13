import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { deleteFrankDeenieDonation, updateFrankDeenieDonation } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";

const FRANK_DEENIE_ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ donationId: string }> }
) {
  try {
    const { donationId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...FRANK_DEENIE_ALLOWED_ROLES]);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Request body must be a JSON object.");
    }

    const hasDate = Object.prototype.hasOwnProperty.call(body, "date");
    const hasType = Object.prototype.hasOwnProperty.call(body, "type");
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasMemo = Object.prototype.hasOwnProperty.call(body, "memo");
    const hasSplit = Object.prototype.hasOwnProperty.call(body, "split");
    const hasAmount = Object.prototype.hasOwnProperty.call(body, "amount");
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");

    if (!hasDate && !hasType && !hasName && !hasMemo && !hasSplit && !hasAmount && !hasStatus) {
      throw new HttpError(400, "No editable fields were provided.");
    }

    const donation = await updateFrankDeenieDonation(admin, {
      donationId,
      ...(hasDate ? { date: String(body.date ?? "") } : {}),
      ...(hasType ? { type: String(body.type ?? "") } : {}),
      ...(hasName ? { name: String(body.name ?? "") } : {}),
      ...(hasMemo
        ? { memo: body.memo === null ? null : String(body.memo ?? "") }
        : {}),
      ...(hasSplit
        ? { split: body.split === null ? null : String(body.split ?? "") }
        : {}),
      ...(hasAmount ? { amount: Number(body.amount) } : {}),
      ...(hasStatus ? { status: String(body.status ?? "") } : {}),
      requesterId: profile.id
    });

    return NextResponse.json({ donation });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ donationId: string }> }
) {
  try {
    const { donationId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...FRANK_DEENIE_ALLOWED_ROLES]);

    await deleteFrankDeenieDonation(admin, donationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
