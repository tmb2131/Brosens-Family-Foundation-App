import webpush from "web-push";
import { SupabaseClient } from "@supabase/supabase-js";
import { AppRole, NotificationPreferences, PushNotificationEventType } from "@/lib/types";
import { HttpError } from "@/lib/http-error";

type AdminClient = SupabaseClient;

const MAX_DELIVERY_ATTEMPTS = 5;

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  proposalCreated: true,
  proposalReadyForMeeting: true,
  proposalStatusChanged: true,
  policyUpdatePublished: true,
  proposalApprovedForAdmin: true
};

interface NotificationPreferenceRow {
  user_id: string;
  push_enabled: boolean;
  proposal_created: boolean;
  proposal_ready_for_meeting: boolean;
  proposal_status_changed: boolean;
  policy_update_published: boolean;
  proposal_approved_for_admin: boolean;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
}

interface NotificationEventRow {
  id: string;
  event_type: PushNotificationEventType;
  title: string;
  body: string;
  link_path: string;
  payload: Record<string, unknown> | null;
  processed_at: string | null;
}

interface NotificationDeliveryRow {
  id: string;
  event_id: string;
  subscription_id: string;
  user_id: string;
  attempt_count: number;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  platform?: string;
}

export interface QueuePushEventInput {
  eventType: PushNotificationEventType;
  actorUserId?: string | null;
  entityId?: string | null;
  title: string;
  body: string;
  linkPath: string;
  payload?: Record<string, unknown>;
  recipientUserIds: string[];
  idempotencyKey: string;
}

export interface ProcessPushDeliveryResult {
  processed: number;
  sent: number;
  failed: number;
  permanentFailures: number;
  pendingRetries: number;
  skipped: number;
  configMissing: boolean;
}

type NotificationPreferencesPatch = Partial<NotificationPreferences>;

let configuredVapidSignature: string | null = null;

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function mapPreferenceRow(row: NotificationPreferenceRow): NotificationPreferences {
  return {
    pushEnabled: row.push_enabled,
    proposalCreated: row.proposal_created,
    proposalReadyForMeeting: row.proposal_ready_for_meeting,
    proposalStatusChanged: row.proposal_status_changed,
    policyUpdatePublished: row.policy_update_published,
    proposalApprovedForAdmin: row.proposal_approved_for_admin
  };
}

function mapPreferencePatchToDatabase(patch: NotificationPreferencesPatch) {
  const updates: Partial<NotificationPreferenceRow> = {};

  if (patch.pushEnabled !== undefined) {
    updates.push_enabled = Boolean(patch.pushEnabled);
  }
  if (patch.proposalCreated !== undefined) {
    updates.proposal_created = Boolean(patch.proposalCreated);
  }
  if (patch.proposalReadyForMeeting !== undefined) {
    updates.proposal_ready_for_meeting = Boolean(patch.proposalReadyForMeeting);
  }
  if (patch.proposalStatusChanged !== undefined) {
    updates.proposal_status_changed = Boolean(patch.proposalStatusChanged);
  }
  if (patch.policyUpdatePublished !== undefined) {
    updates.policy_update_published = Boolean(patch.policyUpdatePublished);
  }
  if (patch.proposalApprovedForAdmin !== undefined) {
    updates.proposal_approved_for_admin = Boolean(patch.proposalApprovedForAdmin);
  }

  return updates;
}

function isUniqueConstraintError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || error?.message?.toLowerCase().includes("duplicate key") || false;
}

function sanitizeLinkPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function getPreferenceForEvent(
  preferences: NotificationPreferences,
  eventType: PushNotificationEventType
) {
  switch (eventType) {
    case "proposal_created":
      return preferences.proposalCreated;
    case "proposal_ready_for_meeting":
      return preferences.proposalReadyForMeeting;
    case "proposal_status_changed":
      return preferences.proposalStatusChanged;
    case "policy_update_published":
      return preferences.policyUpdatePublished;
    case "proposal_approved_for_admin":
      return preferences.proposalApprovedForAdmin;
    default:
      return true;
  }
}

function toWebPushPayload(event: NotificationEventRow) {
  const data = event.payload && typeof event.payload === "object" ? event.payload : {};

  return JSON.stringify({
    title: event.title,
    body: event.body,
    tag: `${event.event_type}:${event.id}`,
    data: {
      ...data,
      eventId: event.id,
      eventType: event.event_type,
      linkPath: event.link_path
    }
  });
}

function resolveNextRetryAt(attemptCount: number) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function truncateErrorMessage(message: string) {
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

function getWebPushErrorDetails(error: unknown) {
  const fallback = {
    statusCode: null as number | null,
    message: "Unknown push delivery failure."
  };

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const statusCode =
    typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? ((error as { statusCode: number }).statusCode as number)
      : null;

  const message =
    typeof (error as { body?: unknown }).body === "string"
      ? (error as { body: string }).body
      : typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : fallback.message;

  return {
    statusCode,
    message: truncateErrorMessage(message)
  };
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";

  if (!publicKey || !privateKey || !subject) {
    return {
      ready: false as const,
      publicKey: publicKey || null
    };
  }

  const signature = `${subject}|${publicKey}|${privateKey}`;
  if (configuredVapidSignature !== signature) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configuredVapidSignature = signature;
  }

  return {
    ready: true as const,
    publicKey
  };
}

async function loadPreferencesByUserId(
  admin: AdminClient,
  userIds: string[]
): Promise<Map<string, NotificationPreferences>> {
  const uniqueUserIds = uniqueIds(userIds);
  if (!uniqueUserIds.length) {
    return new Map();
  }

  const { data, error } = await admin
    .from("notification_preferences")
    .select(
      "user_id, push_enabled, proposal_created, proposal_ready_for_meeting, proposal_status_changed, policy_update_published, proposal_approved_for_admin"
    )
    .in("user_id", uniqueUserIds)
    .returns<NotificationPreferenceRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load notification preferences: ${error.message}`);
  }

  const mapped = new Map<string, NotificationPreferences>();
  for (const userId of uniqueUserIds) {
    mapped.set(userId, DEFAULT_NOTIFICATION_PREFERENCES);
  }

  for (const row of data ?? []) {
    mapped.set(row.user_id, mapPreferenceRow(row));
  }

  return mapped;
}

async function markEventProcessed(admin: AdminClient, eventId: string) {
  const { error } = await admin
    .from("notification_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", eventId)
    .is("processed_at", null);

  if (error) {
    throw new HttpError(500, `Could not mark notification event as processed: ${error.message}`);
  }
}

async function markEventsProcessedIfDone(admin: AdminClient, eventIds: string[]) {
  const uniqueEventIds = uniqueIds(eventIds);
  for (const eventId of uniqueEventIds) {
    const { count, error: pendingCountError } = await admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "pending");

    if (pendingCountError) {
      throw new HttpError(
        500,
        `Could not verify pending notification deliveries: ${pendingCountError.message}`
      );
    }

    if ((count ?? 0) === 0) {
      await markEventProcessed(admin, eventId);
    }
  }
}

export async function listUserIdsByRoles(admin: AdminClient, roles: AppRole[]) {
  if (!roles.length) {
    return [];
  }

  const { data, error } = await admin.from("user_profiles").select("id, role").in("role", roles);

  if (error) {
    throw new HttpError(500, `Could not load user profiles for notifications: ${error.message}`);
  }

  return uniqueIds((data ?? []).map((row) => String(row.id)));
}

export function getPublicVapidKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

export function isPushConfigured() {
  return configureWebPush().ready;
}

export async function getNotificationPreferences(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("notification_preferences")
    .select(
      "user_id, push_enabled, proposal_created, proposal_ready_for_meeting, proposal_status_changed, policy_update_published, proposal_approved_for_admin"
    )
    .eq("user_id", userId)
    .maybeSingle<NotificationPreferenceRow>();

  if (error) {
    throw new HttpError(500, `Could not load notification preferences: ${error.message}`);
  }

  const preferences = data ? mapPreferenceRow(data) : DEFAULT_NOTIFICATION_PREFERENCES;

  const { count, error: subscriptionCountError } = await admin
    .from("push_subscriptions")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (subscriptionCountError) {
    throw new HttpError(500, `Could not load push subscriptions: ${subscriptionCountError.message}`);
  }

  return {
    preferences,
    hasActiveSubscription: (count ?? 0) > 0
  };
}

export async function updateNotificationPreferences(
  admin: AdminClient,
  userId: string,
  patch: NotificationPreferencesPatch
) {
  const updates = mapPreferencePatchToDatabase(patch);
  if (!Object.keys(updates).length) {
    return (await getNotificationPreferences(admin, userId)).preferences;
  }

  const { error } = await admin.from("notification_preferences").upsert(
    {
      user_id: userId,
      ...updates
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new HttpError(500, `Could not save notification preferences: ${error.message}`);
  }

  return (await getNotificationPreferences(admin, userId)).preferences;
}

export async function savePushSubscription(
  admin: AdminClient,
  userId: string,
  input: PushSubscriptionInput
) {
  const endpoint = String(input.endpoint ?? "").trim();
  const p256dh = String(input.keys?.p256dh ?? "").trim();
  const auth = String(input.keys?.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new HttpError(400, "Subscription endpoint and keys are required.");
  }

  const userAgent = String(input.userAgent ?? "").trim() || null;
  const platform = String(input.platform ?? "").trim() || null;
  const now = new Date().toISOString();

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      platform,
      is_active: true,
      last_seen_at: now
    },
    {
      onConflict: "endpoint"
    }
  );

  if (error) {
    throw new HttpError(500, `Could not save push subscription: ${error.message}`);
  }
}

export async function deactivatePushSubscription(
  admin: AdminClient,
  userId: string,
  endpoint?: string
) {
  const normalizedEndpoint = endpoint?.trim();
  let query = admin
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (normalizedEndpoint) {
    query = query.eq("endpoint", normalizedEndpoint);
  }

  const { error } = await query;
  if (error) {
    throw new HttpError(500, `Could not deactivate push subscription: ${error.message}`);
  }
}

export async function queuePushEvent(admin: AdminClient, input: QueuePushEventInput) {
  const recipients = uniqueIds(input.recipientUserIds);
  if (!recipients.length) {
    return {
      enqueued: false,
      reason: "no_recipients"
    } as const;
  }

  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  const idempotencyKey = String(input.idempotencyKey ?? "").trim();

  if (!title || !body || !idempotencyKey) {
    throw new HttpError(500, "Notification event requires title, body, and idempotencyKey.");
  }

  const insertPayload = {
    event_type: input.eventType,
    actor_user_id: input.actorUserId ?? null,
    entity_id: input.entityId ?? null,
    idempotency_key: idempotencyKey,
    title,
    body,
    link_path: sanitizeLinkPath(input.linkPath),
    payload: input.payload ?? {},
    recipient_user_ids: recipients
  };

  const { data: insertedEvent, error: insertError } = await admin
    .from("notification_events")
    .insert(insertPayload)
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    if (isUniqueConstraintError(insertError)) {
      return {
        enqueued: false,
        reason: "duplicate"
      } as const;
    }

    throw new HttpError(500, `Could not enqueue notification event: ${insertError.message}`);
  }

  const eventId = insertedEvent?.id;
  if (!eventId) {
    throw new HttpError(500, "Notification event insert did not return an event ID.");
  }

  const preferencesByUser = await loadPreferencesByUserId(admin, recipients);
  const eligibleRecipients = recipients.filter((recipientId) => {
    const preferences = preferencesByUser.get(recipientId) ?? DEFAULT_NOTIFICATION_PREFERENCES;
    if (!preferences.pushEnabled) {
      return false;
    }
    return getPreferenceForEvent(preferences, input.eventType);
  });

  if (!eligibleRecipients.length) {
    await markEventProcessed(admin, eventId);
    return {
      enqueued: true,
      eventId,
      queuedDeliveryCount: 0
    } as const;
  }

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id, user_id")
    .in("user_id", eligibleRecipients)
    .eq("is_active", true)
    .returns<Array<Pick<PushSubscriptionRow, "id" | "user_id">>>();

  if (subscriptionError) {
    throw new HttpError(500, `Could not load push subscriptions: ${subscriptionError.message}`);
  }

  const deliveries = (subscriptions ?? []).map((subscription) => ({
    event_id: eventId,
    subscription_id: subscription.id,
    user_id: subscription.user_id,
    status: "pending" as const,
    next_attempt_at: new Date().toISOString()
  }));

  if (!deliveries.length) {
    await markEventProcessed(admin, eventId);
    return {
      enqueued: true,
      eventId,
      queuedDeliveryCount: 0
    } as const;
  }

  const { error: deliveryError } = await admin
    .from("notification_deliveries")
    .upsert(deliveries, { onConflict: "event_id,subscription_id" });

  if (deliveryError) {
    throw new HttpError(500, `Could not enqueue notification deliveries: ${deliveryError.message}`);
  }

  void processPendingPushDeliveries(admin, { limit: Math.max(25, deliveries.length) }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[push] background processing failed", message);
  });

  return {
    enqueued: true,
    eventId,
    queuedDeliveryCount: deliveries.length
  } as const;
}

export async function processPendingPushDeliveries(
  admin: AdminClient,
  options?: { limit?: number }
): Promise<ProcessPushDeliveryResult> {
  const limit = Math.max(1, Math.min(200, options?.limit ?? 50));
  const config = configureWebPush();

  if (!config.ready) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      permanentFailures: 0,
      pendingRetries: 0,
      skipped: 0,
      configMissing: true
    };
  }

  const now = new Date().toISOString();
  const { data: pendingRows, error: pendingError } = await admin
    .from("notification_deliveries")
    .select("id, event_id, subscription_id, user_id, attempt_count")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit)
    .returns<NotificationDeliveryRow[]>();

  if (pendingError) {
    throw new HttpError(500, `Could not load pending notification deliveries: ${pendingError.message}`);
  }

  const pendingDeliveries = pendingRows ?? [];
  if (!pendingDeliveries.length) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      permanentFailures: 0,
      pendingRetries: 0,
      skipped: 0,
      configMissing: false
    };
  }

  const eventIds = uniqueIds(pendingDeliveries.map((row) => row.event_id));
  const subscriptionIds = uniqueIds(pendingDeliveries.map((row) => row.subscription_id));

  const [{ data: events, error: eventError }, { data: subscriptions, error: subscriptionError }] =
    await Promise.all([
      admin
        .from("notification_events")
        .select("id, event_type, title, body, link_path, payload, processed_at")
        .in("id", eventIds)
        .returns<NotificationEventRow[]>(),
      admin
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth, is_active")
        .in("id", subscriptionIds)
        .returns<PushSubscriptionRow[]>()
    ]);

  if (eventError) {
    throw new HttpError(500, `Could not load notification events: ${eventError.message}`);
  }
  if (subscriptionError) {
    throw new HttpError(500, `Could not load push subscriptions: ${subscriptionError.message}`);
  }

  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const subscriptionById = new Map((subscriptions ?? []).map((subscription) => [subscription.id, subscription]));

  let sent = 0;
  let failed = 0;
  let permanentFailures = 0;
  let pendingRetries = 0;
  let skipped = 0;
  const touchedEventIds: string[] = [];

  for (const delivery of pendingDeliveries) {
    touchedEventIds.push(delivery.event_id);

    const event = eventById.get(delivery.event_id);
    if (!event) {
      skipped += 1;
      const { error } = await admin
        .from("notification_deliveries")
        .update({
          status: "failed",
          attempt_count: delivery.attempt_count + 1,
          last_attempt_at: now,
          last_error: "Notification event no longer exists."
        })
        .eq("id", delivery.id);

      if (error) {
        throw new HttpError(500, `Could not update missing-event delivery: ${error.message}`);
      }
      continue;
    }

    const subscription = subscriptionById.get(delivery.subscription_id);
    if (!subscription || !subscription.is_active) {
      skipped += 1;
      const { error } = await admin
        .from("notification_deliveries")
        .update({
          status: "permanent_failure",
          attempt_count: delivery.attempt_count + 1,
          last_attempt_at: now,
          last_error: "Push subscription is inactive."
        })
        .eq("id", delivery.id);

      if (error) {
        throw new HttpError(500, `Could not update inactive-subscription delivery: ${error.message}`);
      }
      continue;
    }

    const attemptCount = delivery.attempt_count + 1;
    const payload = toWebPushPayload(event);

    try {
      const response = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        },
        payload,
        {
          TTL: 300,
          urgency: "high",
          topic: `${event.event_type}:${event.id}`.slice(0, 32)
        }
      );

      const { error } = await admin
        .from("notification_deliveries")
        .update({
          status: "sent",
          attempt_count: attemptCount,
          sent_at: new Date().toISOString(),
          last_attempt_at: now,
          last_response_code:
            typeof response?.statusCode === "number" ? (response.statusCode as number) : null,
          last_error: null
        })
        .eq("id", delivery.id);

      if (error) {
        throw new HttpError(500, `Could not update sent notification delivery: ${error.message}`);
      }

      sent += 1;
    } catch (error) {
      const { statusCode, message } = getWebPushErrorDetails(error);

      if (statusCode === 404 || statusCode === 410) {
        const [subscriptionUpdate, deliveryUpdate] = await Promise.all([
          admin
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("id", subscription.id),
          admin
            .from("notification_deliveries")
            .update({
              status: "permanent_failure",
              attempt_count: attemptCount,
              last_attempt_at: now,
              last_response_code: statusCode,
              last_error: message
            })
            .eq("id", delivery.id)
        ]);

        if (subscriptionUpdate.error) {
          throw new HttpError(
            500,
            `Could not deactivate expired push subscription: ${subscriptionUpdate.error.message}`
          );
        }
        if (deliveryUpdate.error) {
          throw new HttpError(
            500,
            `Could not update expired-subscription delivery: ${deliveryUpdate.error.message}`
          );
        }

        permanentFailures += 1;
        continue;
      }

      if (attemptCount >= MAX_DELIVERY_ATTEMPTS) {
        const { error: deliveryError } = await admin
          .from("notification_deliveries")
          .update({
            status: "failed",
            attempt_count: attemptCount,
            last_attempt_at: now,
            last_response_code: statusCode,
            last_error: message
          })
          .eq("id", delivery.id);

        if (deliveryError) {
          throw new HttpError(500, `Could not update failed notification delivery: ${deliveryError.message}`);
        }

        failed += 1;
        continue;
      }

      const { error: deliveryError } = await admin
        .from("notification_deliveries")
        .update({
          status: "pending",
          attempt_count: attemptCount,
          last_attempt_at: now,
          last_response_code: statusCode,
          last_error: message,
          next_attempt_at: resolveNextRetryAt(attemptCount)
        })
        .eq("id", delivery.id);

      if (deliveryError) {
        throw new HttpError(500, `Could not schedule retry for notification delivery: ${deliveryError.message}`);
      }

      pendingRetries += 1;
    }
  }

  await markEventsProcessedIfDone(admin, touchedEventIds);

  return {
    processed: pendingDeliveries.length,
    sent,
    failed,
    permanentFailures,
    pendingRetries,
    skipped,
    configMissing: false
  };
}
