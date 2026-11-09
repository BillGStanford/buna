"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { trackStartupConversion } from "@/lib/analytics/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/utils";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { followSchema } from "@/lib/validation/launch";
import type { ActionState } from "@/lib/types";

const log = createLogger("follow");

export async function toggleFollowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData);
  const parsed = followSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Something went wrong." };
  if (!(await rateLimit(`follow:${profile.id}`, 60, 3600))) return { status: "error", message: "You’re doing that a lot. Please wait a few minutes." };

  const { targetType, targetId, intent } = parsed.data;
  const supabase = await createClient();

  if (intent === "follow") {
    if (targetType === "user" && targetId === profile.id) return { status: "error", message: "You can’t follow yourself." };
    const source = targetType === "startup" ? "startups" : "public_profiles";
    let q = supabase.from(source).select("id").eq("id", targetId);
    if (targetType === "startup") q = q.eq("status", "published");
    const { data: target } = await q.maybeSingle();
    if (!target) return { status: "error", message: "That isn’t available to follow." };
    const { error } = await supabase.from("follows").insert({ follower_id: profile.id, target_type: targetType, target_id: targetId });
    if (error && error.code !== "23505") {
      log.error("follow failed", error, { code: error.code });
      return { status: "error", message: "We couldn’t follow that. Please try again." };
    }
  } else {
    const { error } = await supabase.from("follows").delete().eq("follower_id", profile.id).eq("target_type", targetType).eq("target_id", targetId);
    if (error) {
      log.error("unfollow failed", error, { code: error.code });
      return { status: "error", message: "We couldn’t unfollow. Please try again." };
    }
  }
  revalidatePath(safeRedirectPath(String(raw.returnTo ?? ""), "/"));
  revalidatePath("/dashboard/following");
  return { status: "success", message: intent === "follow" ? "Following." : "Unfollowed." };
}
