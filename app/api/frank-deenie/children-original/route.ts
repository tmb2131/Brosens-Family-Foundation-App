import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";

const ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;

export async function PATCH(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...ALLOWED_ROLES]);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Request body must be a JSON object.");
    }

    const proposalId = typeof body.proposalId === "string" ? body.proposalId.trim() : "";
    if (!proposalId) {
      throw new HttpError(400, "proposalId is required.");
    }

    const hasDate = Object.prototype.hasOwnProperty.call(body, "date");
    const hasAmount = Object.prototype.hasOwnProperty.call(body, "amount");
    if (!hasDate && !hasAmount) {
      throw new HttpError(400, "At least one of date or amount must be provided.");
    }

    const updatePayload: Record<string, unknown> = {};
    if (hasDate) {
      const date = String(body.date ?? "");
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new HttpError(400, "date must be a valid YYYY-MM-DD string.");
      }
      updatePayload.original_sent_at = date;
    }
    if (hasAmount) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new HttpError(400, "amount must be a non-negative number.");
      }
      updatePayload.final_amount = Math.round(amount * 100) / 100;
    }

    const { error } = await admin
      .from("grant_proposals")
      .update(updatePayload)
      .eq("id", proposalId);

    if (error) {
      throw new HttpError(500, `Failed to update proposal: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
