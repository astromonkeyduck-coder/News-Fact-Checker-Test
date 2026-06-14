import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AuditAction } from "@/lib/constants";

export interface AuditEntry {
  teamId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Writes an immutable audit record for a privileged editor action. Uses the
 * service-role client so logging always succeeds regardless of RLS. Failures
 * are swallowed (logging must never block the primary action) but logged to
 * the server console.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminSupabase();
    await admin.from("audit_logs").insert({
      team_id: entry.teamId,
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      detail: entry.detail ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", entry.action, err);
  }
}
