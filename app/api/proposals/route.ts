import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import {
  getFoundationSnapshot,
  submitProposal
} from "@/lib/foundation-data";
import { toErrorResponse, HttpError } from "@/lib/http-error";
import { AllocationMode, ProposalType } from "@/lib/types";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const foundation = await getFoundationSnapshot(admin, profile.id);

    return NextResponse.json({
      proposals: foundation.proposals
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["member", "oversight", "manager"]);

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const proposalType = String(body.proposalType ?? "joint") as ProposalType;
    const requestedAllocationMode = String(body.allocationMode ?? "sum") as AllocationMode;
    const proposedAmount = Number(body.proposedAmount ?? Number.NaN);

    if (!title || !description) {
      throw new HttpError(400, "Missing required fields.");
    }

    if (!["joint", "discretionary"].includes(proposalType)) {
      throw new HttpError(400, "Invalid proposalType.");
    }

    if (!["average", "sum"].includes(requestedAllocationMode)) {
      throw new HttpError(400, "Invalid allocationMode.");
    }

    if (!Number.isFinite(proposedAmount) || proposedAmount < 0) {
      throw new HttpError(400, "proposedAmount must be a non-negative number.");
    }

    const allocationMode: AllocationMode = proposalType === "joint" ? "sum" : requestedAllocationMode;

    const proposal = await submitProposal(admin, {
      title,
      description,
      proposalType,
      allocationMode,
      proposedAmount,
      proposer: profile
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
