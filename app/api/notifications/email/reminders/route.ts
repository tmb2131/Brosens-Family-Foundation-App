import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import {
  processDailyProposalSentDigestEmails,
  processPendingEmailDeliveries,
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
  const fromCronOrWorker = isAuthorizedBySecret(request);
  const manual = !fromCronOrWorker;

  // Only apply DISABLE_EMAIL_CRON to cron/worker (Bearer) requests; manual run from Settings always runs
  if (!manual && process.env.DISABLE_EMAIL_CRON === "true") {
    return NextResponse.json({
      disabled: true,
      message: "Email cron is disabled (DISABLE_EMAIL_CRON=true)."
    });
  }

  const admin = createAdminClient();
  if (!admin) {
    throw new HttpError(
      500,
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  if (!fromCronOrWorker) {
    const context = await requireAuthContext();
    assertRole(context.profile, ["oversight", "admin"]);
  }

  const dailyDigestOptions = manual
    ? {
        ignoreTimeWindow: true,
        sendEvenIfNoSentToday: true
      }
    : undefined;

  const [weeklyUpdate, dailySentDigest] = await Promise.all([
    processWeeklyActionReminderEmails(admin),
    processDailyProposalSentDigestEmails(admin, dailyDigestOptions)
  ]);

  // Explicitly process all pending deliveries before returning the response,
  // since Vercel kills serverless functions after response is sent
  const deliveryResult = await processPendingEmailDeliveries(admin);

  return NextResponse.json({
    weeklyUpdate,
    dailySentDigest,
    deliveryResult
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
