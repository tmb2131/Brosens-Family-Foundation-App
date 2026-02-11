import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { updateProposalRecord } from "@/lib/foundation-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { ProposalStatus } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ proposalId: string }> }
) {
  try {
    const { proposalId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    const body = await request.json();

    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasFinalAmount = Object.prototype.hasOwnProperty.call(body, "finalAmount");
    const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");
    const hasSentAt = Object.prototype.hasOwnProperty.call(body, "sentAt");

    if (!hasStatus && !hasFinalAmount && !hasNotes && !hasSentAt) {
      throw new HttpError(400, "No editable fields were provided.");
    }

    const status = hasStatus ? (String(body.status ?? "").trim() as ProposalStatus) : undefined;

    let finalAmount: number | undefined;
    if (hasFinalAmount) {
      finalAmount = Number(body.finalAmount);
      if (!Number.isFinite(finalAmount)) {
        throw new HttpError(400, "finalAmount must be a valid number.");
      }
    }

    let notes: string | null | undefined;
    if (hasNotes) {
      if (body.notes === null) {
        notes = null;
      } else if (typeof body.notes === "string") {
        notes = body.notes;
      } else {
        throw new HttpError(400, "notes must be a string or null.");
      }
    }

    let sentAt: string | null | undefined;
    if (hasSentAt) {
      if (body.sentAt === null) {
        sentAt = null;
      } else if (typeof body.sentAt === "string") {
        sentAt = body.sentAt;
      } else {
        throw new HttpError(400, "sentAt must be a string date or null.");
      }
    }

    const proposal = await updateProposalRecord(admin, {
      proposalId,
      requesterId: profile.id,
      requesterRole: profile.role,
      ...(hasStatus ? { status } : {}),
      ...(hasFinalAmount ? { finalAmount } : {}),
      ...(hasNotes ? { notes } : {}),
      ...(hasSentAt ? { sentAt } : {}),
      currentUserId: profile.id
    });

    return NextResponse.json({ proposal });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
