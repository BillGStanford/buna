"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveProfile } from "@/lib/auth/session";
import { getManagedStartup } from "@/lib/startups/queries";
import { canEditStartup } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";

const UUID = /^[0-9a-f-]{36}$/i;
const METRICS = ["revenue","customers","active_users","employees","revenue_growth_pct","customer_growth_pct"];
const VISIBILITY = ["public","investors","private"];

async function editable(startupId: string) {
  if (!UUID.test(startupId)) return null;
  const profile = await requireActiveProfile();
  const managed = await getManagedStartup(startupId, profile.id);
  if (!managed || !canEditStartup(managed.role)) return null;
  return { profile, managed };
}

async function sendMilestone(userId: string, startupId: string, key: string, title: string, body: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("startup_enrichment_nudges")
    .insert({ startup_id: startupId, user_id: userId, nudge_key: key }).select("id").maybeSingle();
  if (error || !data) return;
  await admin.rpc("create_notification", {
    p_user: userId, p_type: "startup", p_title: title, p_body: body,
    p_url: "/dashboard/startup/" + startupId + "/intelligence",
    p_dedupe: "enrichment:" + startupId + ":" + userId + ":" + key, p_pref: null,
  });
}

export async function saveStartupMetricAction(fd: FormData): Promise<void> {
  const startupId = String(fd.get("startupId") ?? "");
  const ctx = await editable(startupId);
  if (!ctx) return;
  const metricKey = String(fd.get("metricKey") ?? "");
  const rawValue = String(fd.get("value") ?? "").trim();
  const value = Number(rawValue);
  const currency = String(fd.get("currency") ?? "USD").trim().toUpperCase();
  const visibility = String(fd.get("visibility") ?? "investors");
  const start = String(fd.get("periodStart") ?? "").trim();
  const end = String(fd.get("periodEnd") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 1000);
  if (!METRICS.includes(metricKey) || !rawValue || !Number.isFinite(value) || value < 0 || !VISIBILITY.includes(visibility)) return;
  if (["revenue","revenue_growth_pct"].includes(metricKey) && !/^[A-Z]{3}$/.test(currency)) return;
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return;
  if (start && end && start > end) return;
  const supabase = await createClient();
  const { error } = await supabase.from("startup_metrics").insert({
    startup_id: startupId, metric_key: metricKey, value, currency: ["revenue","revenue_growth_pct"].includes(metricKey) ? currency : null,
    period_start: start || null, period_end: end || null, visibility,
    source_status: "founder_reported", notes: notes || null, created_by: ctx.profile.id,
  });
  if (error) return;
  await sendMilestone(ctx.profile.id, startupId, "first_metric", "Your company intelligence is taking shape",
    "You added your first operating metric. Add another reporting period when you have it so investors can understand your progress over time. This is optional.");
  await writeAuditLog({ actorId: ctx.profile.id, action: "startup.metric.create", entityType: "startup", entityId: startupId, metadata: { metricKey, visibility } });
  revalidatePath("/dashboard/startup/" + startupId + "/intelligence");
  revalidatePath("/startups/" + ctx.managed.startup.slug);
}

export async function saveFundingRoundAction(fd: FormData): Promise<void> {
  const startupId = String(fd.get("startupId") ?? "");
  const ctx = await editable(startupId);
  if (!ctx) return;
  const roundName = String(fd.get("roundName") ?? "").trim().slice(0, 80);
  const rawAmount = String(fd.get("amount") ?? "").trim();
  const amount = rawAmount ? Number(rawAmount) : null;
  const currency = String(fd.get("currency") ?? "USD").trim().toUpperCase();
  const announcedOn = String(fd.get("announcedOn") ?? "").trim();
  const leadInvestor = String(fd.get("leadInvestor") ?? "").trim().slice(0, 160);
  const sourceUrl = String(fd.get("sourceUrl") ?? "").trim();
  const visibility = String(fd.get("visibility") ?? "investors");
  if (roundName.length < 2 || (amount !== null && (!Number.isFinite(amount) || amount < 0)) || !VISIBILITY.includes(visibility)) return;
  if (amount !== null && !/^[A-Z]{3}$/.test(currency)) return;
  if (sourceUrl) { try { const u = new URL(sourceUrl); if (!["http:","https:"].includes(u.protocol)) return; } catch { return; } }
  if (announcedOn && !/^\d{4}-\d{2}-\d{2}$/.test(announcedOn)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("startup_funding_rounds").insert({
    startup_id: startupId, round_name: roundName, amount, currency: amount === null ? null : currency,
    announced_on: announcedOn || null, lead_investor: leadInvestor || null, source_url: sourceUrl || null,
    visibility, source_status: "founder_reported", created_by: ctx.profile.id,
  });
  if (error) return;
  await sendMilestone(ctx.profile.id, startupId, "first_funding_round", "Your funding history has a starting point",
    "You recorded a funding round. If you have another historical round or a public announcement, you can add it to give investors a clearer picture. This is optional.");
  await writeAuditLog({ actorId: ctx.profile.id, action: "startup.funding_round.create", entityType: "startup", entityId: startupId, metadata: { visibility } });
  revalidatePath("/dashboard/startup/" + startupId + "/intelligence");
  revalidatePath("/startups/" + ctx.managed.startup.slug);
}

export async function addCompanyClaimAction(fd: FormData): Promise<void> {
  const startupId = String(fd.get("startupId") ?? "");
  const ctx = await editable(startupId);
  if (!ctx) return;
  const claimType = String(fd.get("claimType") ?? "other");
  const claimText = String(fd.get("claimText") ?? "").trim().slice(0, 2000);
  const visibility = String(fd.get("visibility") ?? "investors");
  const evidenceUrl = String(fd.get("evidenceUrl") ?? "").trim();
  const description = String(fd.get("evidenceDescription") ?? "").trim().slice(0, 500);
  if (!["founding_date","revenue","customers","growth","funding","market_presence","other"].includes(claimType) || claimText.length < 2 || !VISIBILITY.includes(visibility)) return;
  if (evidenceUrl) { try { const u = new URL(evidenceUrl); if (!["http:","https:"].includes(u.protocol)) return; } catch { return; } }
  const supabase = await createClient();
  const { data: claim, error } = await supabase.from("startup_data_claims").insert({
    startup_id: startupId, claim_type: claimType, claim_text: claimText,
    visibility, source_status: "founder_reported", created_by: ctx.profile.id,
  }).select("id").single();
  if (error || !claim) return;
  if (evidenceUrl) {
    const { error: evidenceError } = await supabase.from("startup_claim_evidence").insert({
      claim_id: claim.id, evidence_url: evidenceUrl, description: description || null, added_by: ctx.profile.id,
    });
    if (evidenceError) return;
  }
  await writeAuditLog({ actorId: ctx.profile.id, action: "startup.claim.create", entityType: "startup", entityId: startupId, metadata: { claimType, hasEvidence: Boolean(evidenceUrl) } });
  revalidatePath("/dashboard/startup/" + startupId + "/intelligence");
}

export async function dismissEnrichmentNudgeAction(fd: FormData): Promise<void> {
  const startupId = String(fd.get("startupId") ?? "");
  const nudgeId = String(fd.get("nudgeId") ?? "");
  const ctx = await editable(startupId);
  if (!ctx || !UUID.test(nudgeId)) return;
  const supabase = await createClient();
  await supabase.from("startup_enrichment_nudges").update({ dismissed_at: new Date().toISOString() })
    .eq("id", nudgeId).eq("startup_id", startupId).eq("user_id", ctx.profile.id);
  revalidatePath("/dashboard/startup/" + startupId + "/intelligence");
}
