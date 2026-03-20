import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { queueFrankDeenieDonationChangeNotification } from "@/lib/email-notifications";
import { deleteFrankDeenieDonation, getFrankDeenieDonationById, updateChildrenDonationNotes, updateFrankDeenieDonation } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { FrankDeenieDonationRow } from "@/lib/types";
import { currency } from "@/lib/utils";

const FRANK_DEENIE_ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;

function buildUpdateDescription(before: FrankDeenieDonationRow, after: FrankDeenieDonationRow): string {
  const changes: string[] = [];
  if (before.date !== after.date) changes.push(`Date changed from ${before.date} to ${after.date}`);
  if (before.amount !== after.amount) changes.push(`Amount changed from ${currency(before.amount)} to ${currency(after.amount)}`);
  if (before.name !== after.name) changes.push(`Name changed from '${before.name}' to '${after.name}'`);
  if (before.status !== after.status) changes.push(`Status changed from ${before.status} to ${after.status}`);
  if (before.type !== after.type) changes.push(`Type changed from ${before.type} to ${after.type}`);
  if (before.split !== after.split) changes.push(`Split changed from '${before.split || "(none)"}' to '${after.split || "(none)"}'`);
  if (before.memo !== after.memo) changes.push(`Notes changed from '${before.memo || "(none)"}' to '${after.memo || "(none)"}'`);
  return changes.join("; ");
}

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

    const hasMemo = Object.prototype.hasOwnProperty.call(body, "memo");

    if (donationId.startsWith("children:")) {
      if (profile.role !== "admin") {
        throw new HttpError(403, "Only admin users can edit Children donation notes.");
      }
      if (!hasMemo) {
        throw new HttpError(400, "Only notes can be edited on Children donations.");
      }

      const proposalId = donationId.slice("children:".length);
      const memoValue = body.memo === null ? null : String(body.memo ?? "");
      await updateChildrenDonationNotes(admin, proposalId, memoValue);

      return NextResponse.json({ success: true });
    }

    const hasDate = Object.prototype.hasOwnProperty.call(body, "date");
    const hasType = Object.prototype.hasOwnProperty.call(body, "type");
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasSplit = Object.prototype.hasOwnProperty.call(body, "split");
    const hasAmount = Object.prototype.hasOwnProperty.call(body, "amount");
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");

    if (!hasDate && !hasType && !hasName && !hasMemo && !hasSplit && !hasAmount && !hasStatus) {
      throw new HttpError(400, "No editable fields were provided.");
    }

    const isMemoOnly = hasMemo && !hasDate && !hasType && !hasName && !hasSplit && !hasAmount && !hasStatus;

    const existing = await getFrankDeenieDonationById(admin, donationId);
    if (existing && (existing.returnRole === "original" || existing.returnRole === "reversal")) {
      const isDateAmountOnly = (hasDate || hasAmount) && !hasType && !hasName && !hasMemo && !hasSplit && !hasStatus;
      if (!(isMemoOnly && profile.role === "admin") && !isDateAmountOnly) {
        throw new HttpError(400, "Returned or reversal donations cannot be edited.");
      }
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

    if (hasAmount || hasDate) {
      const { data: rawRow } = await admin
        .from("frank_deenie_donations")
        .select("return_source_id, return_role")
        .eq("id", donationId)
        .maybeSingle<{ return_source_id: string | null; return_role: string | null }>();

      if (rawRow?.return_source_id && rawRow.return_role === "replacement") {
        const proposalUpdate: Record<string, unknown> = {};
        if (hasAmount) proposalUpdate.final_amount = donation.amount;
        if (hasDate) proposalUpdate.sent_at = donation.date;
        await admin
          .from("grant_proposals")
          .update(proposalUpdate)
          .eq("id", rawRow.return_source_id);
      }
    }

    const changeDescription = existing ? buildUpdateDescription(existing, donation) : undefined;
    queueFrankDeenieDonationChangeNotification(admin, {
      userId: profile.id,
      userEmail: profile.email ?? "",
      action: "updated",
      donationId: donation.id,
      recipientName: donation.name,
      amount: currency(donation.amount),
      donationDate: donation.date,
      changeDescription: changeDescription || undefined
    }).catch(() => {});

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

    const name = donationBeforeDelete?.name ?? "";
    const amount = donationBeforeDelete?.amount ?? 0;
    const date = donationBeforeDelete?.date ?? "";
    queueFrankDeenieDonationChangeNotification(admin, {
      userId: profile.id,
      userEmail: profile.email ?? "",
      action: "deleted",
      donationId,
      recipientName: name,
      amount: currency(amount),
      donationDate: date,
      changeDescription: `Deleted donation to '${name}' for ${currency(amount)} dated ${date}`
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
