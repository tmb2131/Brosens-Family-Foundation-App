import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { createMandateComment, getMandatePolicyDocumentId } from "@/lib/policy-data";
import { MandateSectionKey } from "@/lib/types";

const MANDATE_SECTION_KEYS: MandateSectionKey[] = [
  "missionStatement",
  "structure",
  "jointGivingPolicy",
  "discretionaryGivingPolicy",
  "process",
  "annualCycle",
  "rolesAndResponsibilities",
  "references"
];

function isMandateSectionKey(value: unknown): value is MandateSectionKey {
  return typeof value === "string" && MANDATE_SECTION_KEYS.includes(value as MandateSectionKey);
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const body = await request.json();

    const parentId = body.parentId;
    const sectionKey = body.sectionKey;
    const quotedText = body.quotedText;
    const commentBody = body.body;

    if (typeof commentBody !== "string" || !commentBody.trim()) {
      return NextResponse.json(
        { error: "body is required." },
        { status: 400 }
      );
    }

    if (parentId != null) {
      if (typeof parentId !== "string") {
        return NextResponse.json(
          { error: "Invalid parentId." },
          { status: 400 }
        );
      }
      const comment = await createMandateComment(admin, {
        parentId,
        body: commentBody.trim(),
        authorId: profile.id
      });
      return NextResponse.json(comment);
    }

    if (!isMandateSectionKey(sectionKey)) {
      return NextResponse.json(
        { error: "Invalid section key." },
        { status: 400 }
      );
    }
    if (typeof quotedText !== "string") {
      return NextResponse.json(
        { error: "quotedText is required for new comments." },
        { status: 400 }
      );
    }

    const policyDocumentId = await getMandatePolicyDocumentId(admin);
    const comment = await createMandateComment(admin, {
      policyDocumentId,
      sectionKey,
      quotedText,
      body: commentBody.trim(),
      authorId: profile.id
    });

    return NextResponse.json(comment);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
