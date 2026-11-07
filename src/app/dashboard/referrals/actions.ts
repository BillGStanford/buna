"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile, requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

const REWARDS = {
  founder_circle: { threshold: 5, label: "Founder Circle early access" },
  roundtable: { threshold: 10, label: "Community Builder roundtable" },
} as const;

export async function requestReferralRewardAction(formData: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const key = String(formData.get("rewardKey") ?? "");
  if (!Object.hasOwn(REWARDS, key)) return;
  const reward = REWARDS[key as keyof typeof REWARDS];
  if (!(await rateLimit("referral-reward:" + profile.id, 5, 86400))) return;

  const supabase = await createClient();
  const { count, error } = await supabase.from("referral_attributions")
    .select("referred_user_id", { count: "exact", head: true }).eq("referrer_id", profile.id);
  if (error || (count ?? 0) < reward.threshold) return;

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("referral_reward_requests").upsert({
    user_id: profile.id, reward_key: key, status: "requested",
  }, { onConflict: "user_id,reward_key", ignoreDuplicates: true });
  if (insertError) return;

  await writeAuditLog({ actorId: profile.id, action: "referral_reward.request", entityType: "referral_reward", metadata: { reward: key } });
  revalidatePath("/dashboard/referrals");
  revalidatePath("/admin/referral-rewards");
}

export async function reviewReferralRewardAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("staffNote") ?? "").trim().slice(0, 1000);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approved", "declined"].includes(decision)) return;

  const admin = createAdminClient();
  const { data, error } = await admin.from("referral_reward_requests").update({
    status: decision, staff_note: note || null, reviewed_by: staff.id, reviewed_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "requested").select("user_id, reward_key").maybeSingle();
  if (error || !data) return;

  await writeAuditLog({ actorId: staff.id, action: "referral_reward.review", entityType: "referral_reward", entityId: id, metadata: { reward: data.reward_key, decision } });
  await admin.rpc("create_notification", {
    p_user: data.user_id, p_type: "reply", p_title: decision === "approved" ? "Your referral reward request was approved" : "Your referral reward request was reviewed",
    p_body: note || (decision === "approved" ? "Buna staff approved your request. The team will follow up with next steps." : "Buna staff reviewed your request. Visit Referrals & rewards for details."),
    p_url: "/dashboard/referrals", p_dedupe: "referral-reward-review:" + id, p_pref: "referrals",
  });
  revalidatePath("/admin/referral-rewards");
  revalidatePath("/dashboard/referrals");
}
