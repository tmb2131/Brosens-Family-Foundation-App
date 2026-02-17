import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { resolveMandateCommentThread } from "@/lib/policy-data";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, profile } = await requireAuthContext();
    const { id: commentId } = await context.params;

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID required." }, { status: 400 });
    }

    await resolveMandateCommentThread(admin, {
      commentId,
      resolvedByUserId: profile.id,
      userRole: profile.role
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
