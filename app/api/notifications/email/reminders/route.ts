import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import {
  processDailyProposalSentDigestEmails,
  processPendingEmailDeliveries,
  processWeeklyActionReminderEmails
} from "@/lib/email-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedByWorker } from "@/lib/worker-auth";

async function runReminders(request: NextRequest): Promise<NextResponse> {
  const fromCronOrWorker = isAuthorizedByWorker(request, [
    "EMAIL_WORKER_SECRET",
    "CRON_SECRET"
  ]);
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

  // Manual run: ignore time window so it can run any time; same as cron for "no proposals sent" (do not send digest when none sent)
  const dailyDigestOptions = manual
    ? { ignoreTimeWindow: true }
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
