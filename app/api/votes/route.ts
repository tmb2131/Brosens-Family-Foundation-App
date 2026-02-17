import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { submitVote } from "@/lib/foundation-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { type VoteChoice } from "@/lib/types";

const VALID_VOTE_CHOICES: VoteChoice[] = ["yes", "no", "acknowledged", "flagged"];

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["member", "oversight"]);

    const body = await request.json();
    const proposalId = String(body.proposalId ?? "").trim();
    const rawChoice = String(body.choice ?? "").trim();
    const allocationAmount = Number(body.allocationAmount ?? 0);
    const flagComment =
      body.flagComment != null ? String(body.flagComment).trim() || null : undefined;

    if (!proposalId || !rawChoice) {
      throw new HttpError(400, "Missing required fields.");
    }

    if (!VALID_VOTE_CHOICES.includes(rawChoice as VoteChoice)) {
      throw new HttpError(400, "Invalid vote choice.");
    }

    const choice = rawChoice as VoteChoice;

    if (Number.isNaN(allocationAmount) || allocationAmount < 0) {
      throw new HttpError(400, "Allocation must be a non-negative number.");
    }

    await submitVote(admin, {
      proposalId,
      voterId: profile.id,
      choice,
      allocationAmount,
      flagComment: choice === "flagged" ? flagComment ?? null : undefined
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
