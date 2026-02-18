import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";

export async function POST() {
  try {
    const { profile, admin } = await requireAuthContext();
    const { error } = await admin.rpc("touch_last_accessed_at", {
      p_user_id: profile.id
    });
    if (error) {
      throw new Error(error.message);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
