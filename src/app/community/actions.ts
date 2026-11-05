"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile, requireStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation/common";
import { createCommunityReplySchema, createCommunityThreadSchema, communitySubscriptionSchema, moderateCommunitySchema } from "@/lib/validation/community";
import { dispatchNotificationEmails } from "@/lib/notifications/dispatch";

export async function createCommunityThreadAction(formData: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  if (!(await rateLimit("community-thread:" + profile.id, 5, 3600))) redirect("/community?error=rate");
  const parsed = createCommunityThreadSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) redirect("/community?error=invalid");
  const supabase = await createClient();
  const { data, error } = await supabase.from("community_threads").insert({
    author_id: profile.id, category: parsed.data.category, title: parsed.data.title, body: parsed.data.body,
  }).select("id").single();
  if (error || !data) redirect("/community?error=submit");
  revalidatePath("/community");
  redirect("/community/" + data.id);
}

export async function createCommunityReplyAction(formData: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const parsed = createCommunityReplySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) redirect("/community?error=invalid");
  if (!(await rateLimit("community-reply:" + profile.id, 20, 3600))) redirect("/community/" + parsed.data.threadId + "?error=rate");
  const supabase = await createClient();
  const { error } = await supabase.from("community_replies").insert({
    thread_id: parsed.data.threadId, author_id: profile.id, body: parsed.data.body,
  });
  if (error) redirect("/community/" + parsed.data.threadId + "?error=reply");
  revalidatePath("/community");
  revalidatePath("/community/" + parsed.data.threadId);
  after(() => dispatchNotificationEmails().catch(() => undefined));
  redirect("/community/" + parsed.data.threadId + "#replies");
}

export async function toggleCommunitySubscriptionAction(formData: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const parsed = communitySubscriptionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) redirect("/community");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("community_thread_subscriptions").select("thread_id")
    .eq("thread_id", parsed.data.threadId).eq("user_id", profile.id).maybeSingle();
  if (existing) {
    await supabase.from("community_thread_subscriptions").delete().eq("thread_id", parsed.data.threadId).eq("user_id", profile.id);
  } else {
    await supabase.from("community_thread_subscriptions").insert({ thread_id: parsed.data.threadId, user_id: profile.id });
  }
  revalidatePath("/community/" + parsed.data.threadId);
  redirect("/community/" + parsed.data.threadId);
}

export async function moderateCommunityThreadAction(formData: FormData): Promise<void> {
  await requireStaff();
  const parsed = moderateCommunitySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) redirect("/admin/community?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.from("community_threads").update({ status: parsed.data.status }).eq("id", parsed.data.threadId);
  if (error) redirect("/admin/community?error=save");
  revalidatePath("/admin/community");
  revalidatePath("/community");
}
