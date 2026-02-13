import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { savePushSubscription, updateNotificationPreferences } from "@/lib/push-notifications";

interface PushSubscriptionPayload {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
}

function parseSubscriptionPayload(body: Record<string, unknown>): PushSubscriptionPayload {
  const source = (body.subscription ?? body) as PushSubscriptionPayload;
  return {
    endpoint: source.endpoint,
    keys: source.keys
  };
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const subscription = parseSubscriptionPayload(body);

    const endpoint = String(subscription.endpoint ?? "").trim();
    const p256dh = String(subscription.keys?.p256dh ?? "").trim();
    const auth = String(subscription.keys?.auth ?? "").trim();

    if (!endpoint || !p256dh || !auth) {
      throw new HttpError(400, "Invalid push subscription payload.");
    }

    await savePushSubscription(admin, profile.id, {
      endpoint,
      keys: {
        p256dh,
        auth
      },
      userAgent: String(body.userAgent ?? request.headers.get("user-agent") ?? ""),
      platform: String(body.platform ?? "")
    });

    await updateNotificationPreferences(admin, profile.id, { pushEnabled: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
