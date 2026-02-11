import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import {
  getMeetingProposals,
  setMeetingDecision,
  setMeetingReveal
} from "@/lib/foundation-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { AppRole } from "@/lib/types";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["oversight", "manager"]);

    const proposals = await getMeetingProposals(admin, profile.id);
    return NextResponse.json({ proposals });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();

    const body = await request.json();
    const action = String(body.action ?? "");
    const proposalId = String(body.proposalId ?? "");

    if (!action || !proposalId) {
      throw new HttpError(400, "action and proposalId are required");
    }

    if (action === "reveal") {
      assertRole(profile, ["oversight", "manager"]);
      const reveal = Boolean(body.reveal);
      const proposal = await setMeetingReveal(admin, proposalId, reveal, profile.id);
      return NextResponse.json({ proposal });
    }

    if (action === "decision") {
      const status = String(body.status ?? "");
      if (!status || !["approved", "declined", "sent"].includes(status)) {
        throw new HttpError(400, "Invalid status");
      }

      const allowedRoles: AppRole[] =
        status === "sent" ? ["oversight", "manager", "admin"] : ["oversight", "manager"];
      assertRole(profile, allowedRoles);

      const proposal = await setMeetingDecision(
        admin,
        proposalId,
        status as "approved" | "declined" | "sent",
        profile.id
      );

      return NextResponse.json({ proposal });
    }

    throw new HttpError(400, "Unknown action");
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
