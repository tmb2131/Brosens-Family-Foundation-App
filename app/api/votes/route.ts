import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { submitVote } from "@/lib/foundation-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { VoteChoice } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["member", "oversight"]);

    const body = await request.json();
    const proposalId = String(body.proposalId ?? "").trim();
    const choice = String(body.choice ?? "") as VoteChoice;
    const allocationAmount = Number(body.allocationAmount ?? 0);

    if (!proposalId || !choice) {
      throw new HttpError(400, "Missing required fields.");
    }

    if (!["yes", "no"].includes(choice)) {
      throw new HttpError(400, "Invalid vote choice.");
    }

    if (Number.isNaN(allocationAmount) || allocationAmount < 0) {
      throw new HttpError(400, "Allocation must be a non-negative number.");
    }

    await submitVote(admin, {
      proposalId,
      voterId: profile.id,
      choice,
      allocationAmount
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
