import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { queueFrankDeenieDonationChangeNotification } from "@/lib/email-notifications";
import { deleteFrankDeenieDonation, getFrankDeenieDonationById, updateFrankDeenieDonation } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { currency } from "@/lib/utils";

const FRANK_DEENIE_ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ donationId: string }> }
) {
  try {
    const { donationId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...FRANK_DEENIE_ALLOWED_ROLES]);

    const existing = await getFrankDeenieDonationById(admin, donationId);
    if (existing && (existing.returnRole === "original" || existing.returnRole === "reversal")) {
      throw new HttpError(400, "Returned or reversal donations cannot be edited.");
    }

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

    if (profile.role !== "oversight") {
      queueFrankDeenieDonationChangeNotification(admin, {
        userId: profile.id,
        userEmail: profile.email ?? "",
        action: "updated",
        donationId: donation.id,
        recipientName: donation.name,
        amount: currency(donation.amount),
        donationDate: donation.date
      }).catch(() => {});
    }

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

    const donationBeforeDelete = await getFrankDeenieDonationById(admin, donationId);
    if (donationBeforeDelete?.returnRole) {
      throw new HttpError(400, "Donations that are part of a return group cannot be deleted.");
    }

    await deleteFrankDeenieDonation(admin, donationId);

    if (profile.role !== "oversight") {
      queueFrankDeenieDonationChangeNotification(admin, {
        userId: profile.id,
        userEmail: profile.email ?? "",
        action: "deleted",
        donationId,
        recipientName: donationBeforeDelete?.name ?? "",
        amount: currency(donationBeforeDelete?.amount ?? 0),
        donationDate: donationBeforeDelete?.date ?? ""
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
