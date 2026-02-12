import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { getMandatePolicyPageData, updateMandatePolicy } from "@/lib/policy-data";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    const data = await getMandatePolicyPageData(admin, profile);
    return NextResponse.json(data);
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

    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
