import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { queueFrankDeenieDonationChangeNotification } from "@/lib/email-notifications";
import { getFrankDeenieDonationById, markDonationReturned } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { DonationLedgerSource } from "@/lib/types";
import { currency } from "@/lib/utils";

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

    let originalName = "";
    let originalAmount = 0;
    if (source === "frank_deenie") {
      const original = await getFrankDeenieDonationById(admin, sourceId);
      if (original) {
        originalName = original.name;
        originalAmount = original.amount;
      }
    } else {
      const { data: proposal } = await admin
        .from("grant_proposals")
        .select("organization_id, final_amount")
        .eq("id", sourceId)
        .maybeSingle<{ organization_id: string | null; final_amount: number | string }>();
      if (proposal) {
        originalAmount = Number(proposal.final_amount) || 0;
        if (proposal.organization_id) {
          const { data: org } = await admin
            .from("organizations")
            .select("name")
            .eq("id", proposal.organization_id)
            .maybeSingle<{ name: string }>();
          originalName = org?.name ?? "";
        }
      }
    }

    const returnedDate = String(body.returnedDate);
    const newDonationDate = body.newDonationDate ? String(body.newDonationDate) : null;
    const newAmount = body.newAmount !== undefined ? Number(body.newAmount) : undefined;

    const result = await markDonationReturned(admin, {
      sourceId,
      source,
      returnedDate,
      newDonationDate,
      newAmount,
      requesterId: profile.id,
    });

    const reissuedAmount = newAmount !== undefined ? newAmount : originalAmount;
    let changeDescription = `Returned check for '${originalName}' (${currency(originalAmount)}).`;
    if (!newDonationDate) {
      changeDescription += ` Re-issuance pending for ${currency(reissuedAmount)}.`;
    } else if (reissuedAmount !== originalAmount) {
      changeDescription += ` Reissued on ${newDonationDate} for ${currency(reissuedAmount)} (was ${currency(originalAmount)}).`;
    } else {
      changeDescription += ` Reissued on ${newDonationDate} for ${currency(reissuedAmount)}.`;
    }

    queueFrankDeenieDonationChangeNotification(admin, {
      userId: profile.id,
      userEmail: profile.email ?? "",
      action: "returned",
      donationId: sourceId,
      recipientName: originalName || "returned check",
      amount: currency(originalAmount),
      donationDate: returnedDate,
      changeDescription,
    }).catch(() => {});

    return NextResponse.json({ success: true, returnGroupId: result.returnGroupId }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
