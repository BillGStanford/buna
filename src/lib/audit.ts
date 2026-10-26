import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("audit");

export type AuditEntry = {
  actorId: string | null;
  action: string; // e.g. "user.suspend", "startup.remove"
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/** Append-only audit trail. Failures are logged loudly but never break the user's action. */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) log.error("audit insert failed", error, { action: entry.action });
  } catch (err) {
    log.error("audit write threw", err, { action: entry.action });
  }
}
