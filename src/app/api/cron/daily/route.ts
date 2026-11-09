import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";
import { dispatchNotificationEmails } from "@/lib/notifications/dispatch";
import { retryPendingInquiryEmails } from "@/lib/inquiries/deliver";
import { createLogger } from "@/lib/logger";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
const log = createLogger("cron");

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // never open when unconfigured
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Daily housekeeping: publish due launches, expire closed opportunities, queue deadline reminders, retry emails, prune rate-limit rows. */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: "service role is not configured" }, { status: 503 });

  const admin = createAdminClient();
  const published = await admin.rpc("publish_due_launches");
  if (published.error) log.error("publish_due_launches failed", published.error);
  const expired = await admin.rpc("expire_past_opportunities");
  if (expired.error) log.error("expire_past_opportunities failed", expired.error);
  const reminders = await admin.rpc("queue_deadline_reminders");
  if (reminders.error) log.error("queue_deadline_reminders failed", reminders.error);
  const inquiryRetries = await retryPendingInquiryEmails(50);
  const emails = await dispatchNotificationEmails(100);
  const pruned = await admin.rpc("prune_rate_limits");
  if (pruned.error) log.error("prune_rate_limits failed", pruned.error);
  const analyticsPruned = await admin.rpc("prune_startup_analytics_events");
  if (analyticsPruned.error) log.error("prune_startup_analytics_events failed", analyticsPruned.error);
  return NextResponse.json({
    launchesPublished: published.data ?? 0,
    opportunitiesExpired: expired.data ?? 0,
    deadlineReminders: reminders.data ?? 0,
    inquiryEmailRetries: inquiryRetries,
    emails,
    analyticsEventsPruned: analyticsPruned.data ?? 0,
    ok: !published.error && !pruned.error && !expired.error && !reminders.error && !analyticsPruned.error,
  });
}
