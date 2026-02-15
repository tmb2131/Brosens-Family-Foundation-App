import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { PRIVATE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";
import { getMandatePolicyPageData, updateMandatePolicy } from "@/lib/policy-data";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const data = await getMandatePolicyPageData(admin, profile);
    return NextResponse.json(data, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const body = await request.json();

    const result = await updateMandatePolicy(admin, {
      editorId: profile.id,
      editorRole: profile.role,
      content: body.content
    });

    await writeAuditLog(admin, {
      actorId: profile.id,
      action: "update_mandate_policy",
      entityType: "policy",
      entityId: "mandate",
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
