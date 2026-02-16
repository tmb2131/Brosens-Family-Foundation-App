import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import {
  processDailyProposalSentDigestEmails,
  processIntroductionEmail,
  processWeeklyActionReminderEmails
} from "@/lib/email-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorizedBySecret(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const workerSecret = process.env.EMAIL_WORKER_SECRET?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (workerSecret && authorization === `Bearer ${workerSecret}`) {
    return true;
  }
  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }
  return false;
}

async function runReminders(request: NextRequest): Promise<NextResponse> {
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

  let forceIntroUserId: string | undefined;
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.forceIntroUserId === "string" && body.forceIntroUserId.trim()) {
        forceIntroUserId = body.forceIntroUserId.trim();
      }
    } catch {
      // No JSON body — that's fine
    }
  }

  const [weeklyUpdate, dailySentDigest, introEmail] = await Promise.all([
    processWeeklyActionReminderEmails(admin),
    processDailyProposalSentDigestEmails(admin),
    processIntroductionEmail(admin, forceIntroUserId ? { forceRecipientUserId: forceIntroUserId } : undefined)
  ]);
  return NextResponse.json({
    weeklyUpdate,
    dailySentDigest,
    introEmail
  });
}

export async function GET(request: NextRequest) {
  try {
    return await runReminders(request);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await runReminders(request);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
