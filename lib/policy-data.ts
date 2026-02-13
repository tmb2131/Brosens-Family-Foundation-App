import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import { queuePushEvent } from "@/lib/push-notifications";
import {
  AppRole,
  MandatePolicyContent,
  MandatePolicyPageData,
  MandatePolicySnapshot,
  PolicyChangeNotification,
  PolicyDiscussionFlag,
  PolicyNotificationStatus,
  UserProfile
} from "@/lib/types";
import {
  applyMandateDefaults,
  buildMandateSectionDiffs,
  DEFAULT_MANDATE_POLICY_CONTENT,
  MANDATE_POLICY_SLUG,
  MANDATE_POLICY_TITLE,
  MANDATE_SECTION_LABELS,
  MANDATE_SECTION_ORDER,
  normalizeMandatePolicyContent
} from "@/lib/mandate-policy";

type AdminClient = SupabaseClient;

interface PolicyDocumentRow {
  id: string;
  slug: string;
  title: string;
  version: number;
  content: unknown;
  updated_by: string | null;
  updated_at: string;
}

interface PolicyChangeRow {
  id: string;
  policy_document_id: string;
  version: number;
  previous_content: unknown;
  next_content: unknown;
  changed_by: string | null;
  changed_at: string;
}

interface PolicyNotificationRow {
  id: string;
  change_id: string;
  user_id: string;
  status: PolicyNotificationStatus;
  flag_reason: string | null;
  handled_at: string | null;
  created_at: string;
}

interface UpdateMandatePolicyInput {
  editorId: string;
  editorRole: AppRole;
  content: unknown;
}

export interface UpdateMandatePolicyResult {
  policy: MandatePolicySnapshot;
  diffs: ReturnType<typeof buildMandateSectionDiffs>;
  notifiedUsersCount: number;
}

interface UpdatePolicyNotificationInput {
  notificationId: string;
  userId: string;
  action: "acknowledge" | "flag";
  reason?: string;
}

const POLICY_DOCUMENT_SELECT = "id, slug, title, version, content, updated_by, updated_at";

function logNotificationError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[push] ${context}: ${message}`);
}

function parsePolicyContent(raw: unknown): MandatePolicyContent {
  return applyMandateDefaults(normalizeMandatePolicyContent(raw));
}

function validateMandateContent(content: MandatePolicyContent) {
  for (const key of MANDATE_SECTION_ORDER) {
    if (content[key].trim()) {
      continue;
    }

    throw new HttpError(400, `${MANDATE_SECTION_LABELS[key]} cannot be empty.`);
  }
}

async function loadUserNames(admin: AdminClient, ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, string>();
  }

  const { data, error } = await admin
    .from("user_profiles")
    .select("id, full_name")
    .in("id", uniqueIds)
    .returns<Array<{ id: string; full_name: string }>>();

  if (error) {
    throw new HttpError(500, `Could not load user names: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.id, row.full_name]));
}

async function ensureMandateDocument(admin: AdminClient): Promise<PolicyDocumentRow> {
  const { data, error } = await admin
    .from("policy_documents")
    .select(POLICY_DOCUMENT_SELECT)
    .eq("slug", MANDATE_POLICY_SLUG)
    .maybeSingle<PolicyDocumentRow>();

  if (error) {
    throw new HttpError(500, `Could not load mandate policy document: ${error.message}`);
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } = await admin
    .from("policy_documents")
    .insert({
      slug: MANDATE_POLICY_SLUG,
      title: MANDATE_POLICY_TITLE,
      version: 1,
      content: DEFAULT_MANDATE_POLICY_CONTENT
    })
    .select(POLICY_DOCUMENT_SELECT)
    .single<PolicyDocumentRow>();

  if (insertError || !inserted) {
    throw new HttpError(
      500,
      `Could not initialize mandate policy document: ${insertError?.message ?? "missing row"}`
    );
  }

  return inserted;
}

function mapPolicySnapshot(
  row: PolicyDocumentRow,
  userNamesById: Map<string, string>
): MandatePolicySnapshot {
  return {
    slug: row.slug,
    title: row.title,
    version: row.version,
    content: parsePolicyContent(row.content),
    updatedAt: row.updated_at,
    updatedByName: row.updated_by ? userNamesById.get(row.updated_by) ?? null : null
  };
}

async function listNotificationsForUser(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("policy_change_notifications")
    .select("id, change_id, user_id, status, flag_reason, handled_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<PolicyNotificationRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load policy notifications: ${error.message}`);
  }

  return data ?? [];
}

async function loadChangesByIds(admin: AdminClient, changeIds: string[]) {
  if (!changeIds.length) {
    return [];
  }

  const { data, error } = await admin
    .from("policy_changes")
    .select("id, policy_document_id, version, previous_content, next_content, changed_by, changed_at")
    .in("id", changeIds)
    .returns<PolicyChangeRow[]>();

  if (error) {
    throw new HttpError(500, `Could not load policy change entries: ${error.message}`);
  }

  return data ?? [];
}

function mapNotifications(
  notifications: PolicyNotificationRow[],
  changesById: Map<string, PolicyChangeRow>,
  userNamesById: Map<string, string>
): PolicyChangeNotification[] {
  const mapped: PolicyChangeNotification[] = [];

  for (const notification of notifications) {
    const change = changesById.get(notification.change_id);
    if (!change) {
      continue;
    }

    const previous = parsePolicyContent(change.previous_content);
    const next = parsePolicyContent(change.next_content);

    mapped.push({
      id: notification.id,
      changeId: change.id,
      status: notification.status,
      flagReason: notification.flag_reason,
      handledAt: notification.handled_at,
      createdAt: notification.created_at,
      version: change.version,
      changedAt: change.changed_at,
      changedByName: change.changed_by ? userNamesById.get(change.changed_by) ?? null : null,
      diffs: buildMandateSectionDiffs(previous, next)
    });
  }

  return mapped;
}

async function listDiscussionFlags(
  admin: AdminClient,
  policyDocumentId: string
): Promise<PolicyDiscussionFlag[]> {
  const { data: flaggedNotifications, error: flaggedError } = await admin
    .from("policy_change_notifications")
    .select("id, change_id, user_id, status, flag_reason, handled_at, created_at")
    .eq("status", "flagged")
    .order("handled_at", { ascending: false })
    .limit(50)
    .returns<PolicyNotificationRow[]>();

  if (flaggedError) {
    throw new HttpError(500, `Could not load flagged policy notifications: ${flaggedError.message}`);
  }

  const scopedNotifications = (flaggedNotifications ?? []).filter((row) => row.flag_reason?.trim());
  if (!scopedNotifications.length) {
    return [];
  }

  const changes = await loadChangesByIds(
    admin,
    scopedNotifications.map((row) => row.change_id)
  );
  const policyChanges = changes.filter((row) => row.policy_document_id === policyDocumentId);
  const changesById = new Map(policyChanges.map((change) => [change.id, change]));

  const userNamesById = await loadUserNames(
    admin,
    scopedNotifications.map((row) => row.user_id)
  );

  return scopedNotifications
    .map((row) => {
      const change = changesById.get(row.change_id);
      if (!change || !row.flag_reason?.trim()) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        userName: userNamesById.get(row.user_id) ?? null,
        changeId: row.change_id,
        version: change.version,
        changedAt: change.changed_at,
        flaggedAt: row.handled_at ?? row.created_at,
        reason: row.flag_reason.trim()
      } satisfies PolicyDiscussionFlag;
    })
    .filter((row): row is PolicyDiscussionFlag => Boolean(row));
}

export async function getPendingPolicyNotificationCount(
  admin: AdminClient,
  currentUserId: string,
  currentUserRole: AppRole
) {
  if (currentUserRole === "oversight") {
    return 0;
  }

  const { count, error } = await admin
    .from("policy_change_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", currentUserId)
    .eq("status", "pending");

  if (error) {
    throw new HttpError(500, `Could not count pending policy notifications: ${error.message}`);
  }

  return count ?? 0;
}

export async function getMandatePolicyPageData(
  admin: AdminClient,
  currentUser: UserProfile
): Promise<MandatePolicyPageData> {
  const policyDocument = await ensureMandateDocument(admin);
  const notifications = await listNotificationsForUser(admin, currentUser.id);
  const changes = await loadChangesByIds(
    admin,
    notifications.map((row) => row.change_id)
  );
  const changesById = new Map(changes.map((change) => [change.id, change]));

  const userNamesById = await loadUserNames(admin, [
    ...(policyDocument.updated_by ? [policyDocument.updated_by] : []),
    ...changes.map((change) => change.changed_by).filter((id): id is string => Boolean(id))
  ]);

  return {
    policy: mapPolicySnapshot(policyDocument, userNamesById),
    notifications: mapNotifications(notifications, changesById, userNamesById),
    pendingNotificationsCount: await getPendingPolicyNotificationCount(
      admin,
      currentUser.id,
      currentUser.role
    ),
    discussionFlags:
      currentUser.role === "oversight" ? await listDiscussionFlags(admin, policyDocument.id) : []
  };
}

export async function updateMandatePolicy(
  admin: AdminClient,
  input: UpdateMandatePolicyInput
): Promise<UpdateMandatePolicyResult> {
  if (input.editorRole !== "oversight") {
    throw new HttpError(403, "Only Oversight users can edit mandate policy.");
  }

  const policyDocument = await ensureMandateDocument(admin);
  const previousContent = parsePolicyContent(policyDocument.content);
  const nextContent = normalizeMandatePolicyContent(input.content);

  validateMandateContent(nextContent);

  const diffs = buildMandateSectionDiffs(previousContent, nextContent);
  if (!diffs.length) {
    throw new HttpError(400, "No policy changes detected.");
  }

  const nextVersion = policyDocument.version + 1;

  const { data: updatedRows, error: updateError } = await admin
    .from("policy_documents")
    .update({
      content: nextContent,
      version: nextVersion,
      updated_by: input.editorId
    })
    .eq("id", policyDocument.id)
    .eq("version", policyDocument.version)
    .select(POLICY_DOCUMENT_SELECT)
    .returns<PolicyDocumentRow[]>();

  if (updateError) {
    throw new HttpError(500, `Could not save mandate policy update: ${updateError.message}`);
  }

  const updated = updatedRows?.[0];
  if (!updated) {
    throw new HttpError(409, "Policy update conflict. Please refresh and try again.");
  }

  const { data: change, error: changeError } = await admin
    .from("policy_changes")
    .insert({
      policy_document_id: policyDocument.id,
      version: nextVersion,
      previous_content: previousContent,
      next_content: nextContent,
      changed_by: input.editorId
    })
    .select("id, policy_document_id, version, previous_content, next_content, changed_by, changed_at")
    .single<PolicyChangeRow>();

  if (changeError || !change) {
    throw new HttpError(
      500,
      `Could not record mandate policy change: ${changeError?.message ?? "missing row"}`
    );
  }

  const { data: recipients, error: recipientsError } = await admin
    .from("user_profiles")
    .select("id, role")
    .neq("role", "oversight")
    .returns<Array<{ id: string; role: AppRole }>>();

  if (recipientsError) {
    throw new HttpError(500, `Could not load notification recipients: ${recipientsError.message}`);
  }

  const notificationsToInsert = (recipients ?? []).map((recipient) => ({
    change_id: change.id,
    user_id: recipient.id,
    status: "pending" as const
  }));

  if (notificationsToInsert.length) {
    const { error: notificationError } = await admin
      .from("policy_change_notifications")
      .insert(notificationsToInsert);

    if (notificationError) {
      throw new HttpError(500, `Could not enqueue policy notifications: ${notificationError.message}`);
    }
  }

  if (notificationsToInsert.length) {
    const recipientUserIds = notificationsToInsert.map((entry) => entry.user_id);

    void queuePushEvent(admin, {
      eventType: "policy_update_published",
      actorUserId: input.editorId,
      entityId: change.id,
      title: "Mandate Policy Updated",
      body: `Version ${nextVersion} is available for review in Mandate.`,
      linkPath: "/mandate",
      payload: {
        changeId: change.id,
        version: nextVersion
      },
      recipientUserIds,
      idempotencyKey: `policy-update-published:${change.id}`
    }).catch((error) => {
      logNotificationError("updateMandatePolicy enqueue", error);
    });
  }

  const userNamesById = await loadUserNames(admin, [input.editorId]);

  return {
    policy: mapPolicySnapshot(updated, userNamesById),
    diffs,
    notifiedUsersCount: notificationsToInsert.length
  };
}

export async function updatePolicyNotificationStatus(
  admin: AdminClient,
  input: UpdatePolicyNotificationInput
) {
  const { data: existing, error: existingError } = await admin
    .from("policy_change_notifications")
    .select("id, user_id, status")
    .eq("id", input.notificationId)
    .eq("user_id", input.userId)
    .maybeSingle<{ id: string; user_id: string; status: PolicyNotificationStatus }>();

  if (existingError) {
    throw new HttpError(500, `Could not load notification: ${existingError.message}`);
  }

  if (!existing) {
    throw new HttpError(404, "Policy notification not found.");
  }

  const handledAt = new Date().toISOString();
  const updates: {
    status: PolicyNotificationStatus;
    handled_at: string;
    flag_reason?: string | null;
  } = {
    status: input.action === "acknowledge" ? "acknowledged" : "flagged",
    handled_at: handledAt
  };

  if (input.action === "flag") {
    const reason = (input.reason ?? "").trim();
    if (reason.length < 4) {
      throw new HttpError(400, "Provide a short reason when flagging for discussion.");
    }
    updates.flag_reason = reason;
  } else {
    updates.flag_reason = null;
  }

  const { error: updateError } = await admin
    .from("policy_change_notifications")
    .update(updates)
    .eq("id", input.notificationId)
    .eq("user_id", input.userId);

  if (updateError) {
    throw new HttpError(500, `Could not update notification: ${updateError.message}`);
  }

  return {
    id: input.notificationId,
    status: updates.status
  };
}
