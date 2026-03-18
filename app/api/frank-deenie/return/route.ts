import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { queueFrankDeenieDonationChangeNotification } from "@/lib/email-notifications";
import { markDonationReturned } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { DonationLedgerSource } from "@/lib/types";

const FRANK_DEENIE_ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;
const VALID_SOURCES: DonationLedgerSource[] = ["frank_deenie", "children"];

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...FRANK_DEENIE_ALLOWED_ROLES]);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Request body must be a JSON object.");
    }

    const sourceId = String(body.sourceId ?? "").trim();
    if (!sourceId) {
      throw new HttpError(400, "sourceId is required.");
    }

    const source = String(body.source ?? "").trim() as DonationLedgerSource;
    if (!VALID_SOURCES.includes(source)) {
      throw new HttpError(400, `source must be one of: ${VALID_SOURCES.join(", ")}.`);
    }

    if (!body.returnedDate) {
      throw new HttpError(400, "returnedDate is required.");
    }

    if (!body.newDonationDate) {
      throw new HttpError(400, "newDonationDate is required.");
    }

    const result = await markDonationReturned(admin, {
      sourceId,
      source,
      returnedDate: String(body.returnedDate),
      newDonationDate: String(body.newDonationDate),
      newAmount: body.newAmount !== undefined ? Number(body.newAmount) : undefined,
      requesterId: profile.id,
    });

    if (profile.role !== "oversight") {
      queueFrankDeenieDonationChangeNotification(admin, {
        userId: profile.id,
        userEmail: profile.email ?? "",
        action: "updated",
        donationId: sourceId,
        recipientName: "returned check",
        amount: "",
        donationDate: String(body.returnedDate),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, returnGroupId: result.returnGroupId }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
