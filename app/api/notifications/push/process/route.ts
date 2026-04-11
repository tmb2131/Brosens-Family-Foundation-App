import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { processPendingPushDeliveries } from "@/lib/push-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedByWorker, parseWorkerLimit } from "@/lib/worker-auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const limit = parseWorkerLimit(body);

    const admin = createAdminClient();
    if (!admin) {
      throw new HttpError(
        500,
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    if (!isAuthorizedByWorker(request, "PUSH_WORKER_SECRET")) {
      const context = await requireAuthContext();
      assertRole(context.profile, ["oversight", "admin"]);
    }

    const result = await processPendingPushDeliveries(admin, { limit });
    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
