"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import type { ActionState } from "@/lib/types";

const log = createLogger("member-blocks");

export async function toggleMemberBlockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const targetId = String(formData.get("targetId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId) || targetId === profile.id) {
    return { status: "error", message: "That member can’t be blocked." };
  }
  if (intent !== "block" && intent !== "unblock") return { status: "error", message: "Choose a valid action." };
  if (!(await rateLimit(`member-block:${profile.id}`, 20, 3600))) {
    return { status: "error", message: "You’ve made several changes. Please try again later." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(intent === "block" ? "block_member" : "unblock_member", { p_target: targetId });
  if (error) {
    log.error("member block action failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t update this block. Please try again." };
  }
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/following");
  revalidatePath("/dashboard/blocked");
  return { status: "success", message: intent === "block" ? "Member blocked. Existing follows were removed." : "Member unblocked." };
}
