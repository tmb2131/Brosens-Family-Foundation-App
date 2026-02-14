import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { updateProposalRecord } from "@/lib/foundation-data";
import { writeAuditLog } from "@/lib/audit";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { ProposalStatus } from "@/lib/types";
import { normalizeOptionalHttpUrl } from "@/lib/url-validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ proposalId: string }> }
) {
  try {
    const { proposalId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    const body = await request.json();
    const immutableKeys = [
      "id",
      "proposalId",
      "proposalType",
      "proposerId",
      "budgetYear",
      "createdAt",
      "grantMasterId",
      "organizationId"
    ];
    const attemptedImmutableKeys = immutableKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(body, key)
    );

    if (attemptedImmutableKeys.length) {
      throw new HttpError(
        400,
        `The following proposal fields are immutable: ${attemptedImmutableKeys.join(", ")}.`
      );
    }

    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasFinalAmount = Object.prototype.hasOwnProperty.call(body, "finalAmount");
    const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
    const hasDescription = Object.prototype.hasOwnProperty.call(body, "description");
    const hasProposedAmount = Object.prototype.hasOwnProperty.call(body, "proposedAmount");
    const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");
    const hasWebsite = Object.prototype.hasOwnProperty.call(body, "website");
    const hasCharityNavigatorUrl = Object.prototype.hasOwnProperty.call(body, "charityNavigatorUrl");
    const hasSentAt = Object.prototype.hasOwnProperty.call(body, "sentAt");

    if (
      !hasStatus &&
      !hasFinalAmount &&
      !hasTitle &&
      !hasDescription &&
      !hasProposedAmount &&
      !hasNotes &&
      !hasWebsite &&
      !hasCharityNavigatorUrl &&
      !hasSentAt
    ) {
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

    let title: string | undefined;
    if (hasTitle) {
      if (typeof body.title !== "string") {
        throw new HttpError(400, "title must be a string.");
      }
      title = body.title;
    }

    let description: string | undefined;
    if (hasDescription) {
      if (typeof body.description !== "string") {
        throw new HttpError(400, "description must be a string.");
      }
      description = body.description;
    }

    let proposedAmount: number | undefined;
    if (hasProposedAmount) {
      proposedAmount = Number(body.proposedAmount);
      if (!Number.isFinite(proposedAmount)) {
        throw new HttpError(400, "proposedAmount must be a valid number.");
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

    let website: string | null | undefined;
    if (hasWebsite) {
      website = normalizeOptionalHttpUrl(body.website, "website");
    }

    let charityNavigatorUrl: string | null | undefined;
    if (hasCharityNavigatorUrl) {
      charityNavigatorUrl = normalizeOptionalHttpUrl(
        body.charityNavigatorUrl,
        "charity navigator link"
      );
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
      ...(hasTitle ? { title } : {}),
      ...(hasDescription ? { description } : {}),
      ...(hasProposedAmount ? { proposedAmount } : {}),
      ...(hasNotes ? { notes } : {}),
      ...(hasWebsite ? { website } : {}),
      ...(hasCharityNavigatorUrl ? { charityNavigatorUrl } : {}),
      ...(hasSentAt ? { sentAt } : {}),
      currentUserId: profile.id
    });

    const changedDetailKeys = [
      ...(hasTitle ? ["title"] : []),
      ...(hasDescription ? ["description"] : []),
      ...(hasProposedAmount ? ["proposedAmount"] : []),
      ...(hasNotes ? ["notes"] : []),
      ...(hasWebsite ? ["website"] : []),
      ...(hasCharityNavigatorUrl ? ["charityNavigatorUrl"] : [])
    ];

    if (profile.role === "oversight" && changedDetailKeys.length) {
      await writeAuditLog(admin, {
        actorId: profile.id,
        action: "proposal_details_edited",
        entityType: "proposal",
        entityId: proposalId,
        details: {
          changedKeys: changedDetailKeys
        }
      });
    }

    return NextResponse.json({ proposal });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
