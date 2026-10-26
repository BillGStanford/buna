import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("notifications");

/** Account/security events (e.g. password changed). In-app only; failures are logged, never thrown. */
export async function notifySecurityEvent(userId: string, title: string, body: string): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("create_notification", {
      p_user: userId, p_type: "security", p_title: title, p_body: body, p_url: "/dashboard/security",
      p_dedupe: `security:${Date.now()}`, p_pref: null,
    });
    if (error) log.error("security notification failed", error);
  } catch (err) {
    log.error("security notification threw", err);
  }
}
