import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";
import { queueUserAccessNotification } from "@/lib/email-notifications";

export async function POST() {
  try {
    const { profile, admin } = await requireAuthContext();
    const { data, error } = await admin
      .rpc("touch_last_accessed_at", { p_user_id: profile.id })
      .single<{ updated: boolean; last_accessed_at: string | null }>();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.updated && data?.last_accessed_at && profile.role !== "oversight") {
      const userEmail = profile.email?.trim() ?? "";
      if (userEmail) {
        queueUserAccessNotification(admin, {
          userEmail,
          userId: profile.id,
          lastAccessedAt: data.last_accessed_at
        }).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
        });
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
