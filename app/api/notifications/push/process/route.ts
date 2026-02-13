import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { processPendingPushDeliveries } from "@/lib/push-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorizedBySecret(request: NextRequest) {
  const workerSecret = process.env.PUSH_WORKER_SECRET?.trim();
  if (!workerSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${workerSecret}`;
}

function parseLimit(body: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(body, "limit")) {
    return undefined;
  }

  const parsed = Number(body.limit);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "limit must be a number.");
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const limit = parseLimit(body);

    const admin = createAdminClient();
    if (!admin) {
      throw new HttpError(
        500,
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    if (!isAuthorizedBySecret(request)) {
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
