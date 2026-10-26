import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, isServiceRoleConfigured, getSiteUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail } from "@/lib/email/templates";
import { createLogger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/utils";

const log = createLogger("notifications");

export type DispatchResult = { claimed: number; sent: number; failed: number; notConfigured: number };

/**
 * Sends queued notification emails. Rows are claimed atomically in the database (so concurrent runs
 * never double-send) and each outcome is recorded: sent, failed (retried up to 5 times) or
 * not_configured (the email provider isn't set up — the in-app notification still exists).
 */
export async function dispatchNotificationEmails(limit = 25): Promise<DispatchResult> {
  const result: DispatchResult = { claimed: 0, sent: 0, failed: 0, notConfigured: 0 };
  if (!isServiceRoleConfigured()) return result;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_emails", { p_limit: limit });
  if (error) {
    log.error("claim failed", error);
    return result;
  }
  const rows = (data ?? []) as { id: string; email: string; title: string; body: string | null; url: string | null }[];
  result.claimed = rows.length;
  const configured = isEmailConfigured();

  for (const row of rows) {
    if (!configured) {
      await admin.rpc("finish_notification_email", { p_id: row.id, p_status: "not_configured", p_error: null });
      result.notConfigured++;
      continue;
    }
    const link = row.url ? `${getSiteUrl()}${safeRedirectPath(row.url, "/dashboard/notifications")}` : `${getSiteUrl()}/dashboard/notifications`;
    const { html, text } = renderEmail({
      heading: row.title,
      paragraphs: row.body ? [row.body] : [],
      cta: { label: "View on Buna", url: link },
      footnote: "You’re receiving this because of your notification settings. You can change them in your Buna dashboard.",
    });
    const sent = await sendEmail({ to: row.email, subject: row.title, html, text });
    if (sent.status === "sent") {
      await admin.rpc("finish_notification_email", { p_id: row.id, p_status: "sent", p_error: null });
      result.sent++;
    } else {
      await admin.rpc("finish_notification_email", { p_id: row.id, p_status: "failed", p_error: sent.status === "failed" ? sent.error : "not configured" });
      result.failed++;
    }
  }
  return result;
}
