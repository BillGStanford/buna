"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveProfile } from "@/lib/auth/session";
import { getManagedStartup } from "@/lib/startups/queries";
import { canEditStartup } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { isServiceRoleConfigured } from "@/lib/env";

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
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("startup_enrichment_nudges")
      .insert({ startup_id: startupId, user_id: userId, nudge_key: key }).select("id").maybeSingle();
    if (error || !data) return;
    const { error: notificationError } = await admin.rpc("create_notification", {
      p_user: userId, p_type: "startup", p_title: title, p_body: body,
      p_url: "/dashboard/startup/" + startupId + "/intelligence",
      p_dedupe: "enrichment:" + startupId + ":" + userId + ":" + key, p_pref: null,
    });
    if (notificationError) {
      await admin.from("startup_enrichment_nudges").delete().eq("id", data.id);
    }
  } catch {
    // Enrichment is optional; notification infrastructure must never block a founder's save.
  }
}

export async function evaluateStartupEnrichmentProgress(userId: string, startupId: string): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
  const admin = createAdminClient();
  const [{ data: startup }, { count: metrics }, { count: rounds }, { count: claims }] = await Promise.all([
    admin.from("startups").select("website_url,founded_year,problem_statement,solution,target_customers,target_geographies,business_model,stage").eq("id", startupId).maybeSingle(),
    admin.from("startup_metrics").select("id", { count: "exact", head: true }).eq("startup_id", startupId),
    admin.from("startup_funding_rounds").select("id", { count: "exact", head: true }).eq("startup_id", startupId),
    admin.from("startup_data_claims").select("id", { count: "exact", head: true }).eq("startup_id", startupId),
  ]);
  if (!startup) return;
  const completed = [
    Boolean(startup.website_url), Boolean(startup.founded_year), Boolean(startup.problem_statement),
    Boolean(startup.solution), Boolean(startup.business_model), Boolean(startup.stage),
    Boolean(startup.target_customers?.length), Boolean(startup.target_geographies?.length),
    (metrics ?? 0) > 0, (rounds ?? 0) > 0, (claims ?? 0) > 0,
  ].filter(Boolean).length;
  if (completed >= 8) await sendMilestone(userId, startupId, "optional_profile_70",
    "A suggestion to strengthen your company information",
    "Your profile now has a strong foundation. If you have a public announcement or supporting document, consider adding evidence to one of your company claims. It helps readers understand what has been independently confirmed. This is optional.");
  else if (completed >= 5) await sendMilestone(userId, startupId, "optional_profile_45",
    "Your company profile is becoming more useful",
    "You have added several helpful details. Consider adding a customer or revenue metric with a reporting period so investors can understand progress over time. This is optional.");
  } catch {
    // A failed enrichment suggestion must never interrupt a profile save.
  }
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
  if (!METRICS.includes(metricKey) || !rawValue || !Number.isFinite(value) || (value < 0 && !["revenue_growth_pct","customer_growth_pct"].includes(metricKey)) || !VISIBILITY.includes(visibility)) return;
  if (["revenue"].includes(metricKey) && !/^[A-Z]{3}$/.test(currency)) return;
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return;
  if (start && end && start > end) return;
  const supabase = await createClient();
  const { error } = await supabase.from("startup_metrics").insert({
    startup_id: startupId, metric_key: metricKey, value, currency: ["revenue"].includes(metricKey) ? currency : null,
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
  await evaluateStartupEnrichmentProgress(ctx.profile.id, startupId);
  await writeAuditLog({ actorId: ctx.profile.id, action: "startup.claim.create", entityType: "startup", entityId: startupId, metadata: { claimType, hasEvidence: Boolean(evidenceUrl) } });
  revalidatePath("/dashboard/startup/" + startupId + "/intelligence");
}

export async function saveFounderHistoryAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const companyName = String(fd.get("companyName") ?? "").trim().slice(0, 120);
  const roleTitle = String(fd.get("roleTitle") ?? "").trim().slice(0, 100);
  const description = String(fd.get("description") ?? "").trim().slice(0, 1000);
  const startedOn = String(fd.get("startedOn") ?? "").trim();
  const endedOn = String(fd.get("endedOn") ?? "").trim();
  const visibility = String(fd.get("visibility") ?? "private");
  if (companyName.length < 2 || roleTitle.length < 2 || !VISIBILITY.includes(visibility)) return;
  if (startedOn && !/^\\d{4}-\\d{2}-\\d{2}$/.test(startedOn)) return;
  if (endedOn && !/^\\d{4}-\\d{2}-\\d{2}$/.test(endedOn)) return;
  if (startedOn && endedOn && startedOn > endedOn) return;
  const supabase = await createClient();
  const { error } = await supabase.from("founder_company_history").insert({
    founder_id: profile.id, company_name: companyName, role_title: roleTitle,
    description: description || null, started_on: startedOn || null, ended_on: endedOn || null, visibility,
  });
  if (error) return;
  await writeAuditLog({ actorId: profile.id, action: "founder.company_history.create", entityType: "profile", entityId: profile.id, metadata: { visibility } });
  revalidatePath("/dashboard/startup");
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
