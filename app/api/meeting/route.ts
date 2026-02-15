import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import {
  getMeetingProposals,
  setMeetingDecision,
  setMeetingReveal
} from "@/lib/foundation-data";
import { HttpError, PRIVATE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";
import { writeAuditLog } from "@/lib/audit";
import { AppRole } from "@/lib/types";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["oversight", "manager"]);

    const proposals = await getMeetingProposals(admin, profile.id);
    return NextResponse.json({ proposals }, { headers: PRIVATE_CACHE_HEADERS });
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
    const hasSentAt = Object.prototype.hasOwnProperty.call(body, "sentAt");

    if (!action || !proposalId) {
      throw new HttpError(400, "action and proposalId are required");
    }

    if (action === "reveal") {
      assertRole(profile, ["oversight", "manager"]);
      const reveal = Boolean(body.reveal);
      const proposal = await setMeetingReveal(admin, proposalId, reveal, profile.id);
      await writeAuditLog(admin, {
        actorId: profile.id,
        action: reveal ? "reveal_votes" : "hide_votes",
        entityType: "proposal",
        entityId: proposalId,
      });
      return NextResponse.json({ proposal });
    }

    if (action === "decision") {
      const status = String(body.status ?? "");
      if (!status || !["approved", "declined", "sent"].includes(status)) {
        throw new HttpError(400, "Invalid status");
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

      const allowedRoles: AppRole[] =
        status === "sent" ? ["oversight", "manager", "admin"] : ["oversight", "manager"];
      assertRole(profile, allowedRoles);

      if (
        status === "sent" &&
        profile.role === "admin" &&
        (sentAt === undefined || sentAt === null || !sentAt.trim())
      ) {
        throw new HttpError(400, "sentAt is required when admin marks a proposal as Sent.");
      }

      const proposal = await setMeetingDecision(
        admin,
        proposalId,
        status as "approved" | "declined" | "sent",
        profile.id,
        hasSentAt ? sentAt : undefined
      );

      await writeAuditLog(admin, {
        actorId: profile.id,
        action: `meeting_decision_${status}`,
        entityType: "proposal",
        entityId: proposalId,
        details: { status, sentAt: hasSentAt ? sentAt : undefined },
      });

      return NextResponse.json({ proposal });
    }

    throw new HttpError(400, "Unknown action");
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
