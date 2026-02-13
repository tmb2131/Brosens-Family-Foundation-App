import type { SupabaseClient } from "@supabase/supabase-js";

interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function writeAuditLog(
  admin: SupabaseClient,
  entry: AuditEntry
) {
  const { error } = await admin.from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    details: entry.details ?? {},
  });

  if (error) {
    console.error(`[audit] Failed to write audit log: ${error.message}`);
  }
}
