"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/utils";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { saveOpportunitySchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("opportunity-actions");

export async function toggleSaveOpportunityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData);
  const parsed = saveOpportunitySchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Something went wrong." };
  if (!(await rateLimit(`save:${profile.id}`, 120, 3600))) return { status: "error", message: "You’re doing that a lot. Please wait a few minutes." };
  const supabase = await createClient();
  if (parsed.data.intent === "save") {
    const { data: opp } = await supabase.from("opportunities").select("id").eq("id", parsed.data.opportunityId).maybeSingle();
    if (!opp) return { status: "error", message: "That opportunity isn’t available." };
    const { error } = await supabase.from("saved_opportunities").insert({ user_id: profile.id, opportunity_id: parsed.data.opportunityId });
    if (error && error.code !== "23505") { log.error("save failed", error, { code: error.code }); return { status: "error", message: "We couldn’t save that. Please try again." }; }
  } else {
    const { error } = await supabase.from("saved_opportunities").delete().eq("user_id", profile.id).eq("opportunity_id", parsed.data.opportunityId);
    if (error) return { status: "error", message: "We couldn’t remove that. Please try again." };
  }
  revalidatePath(safeRedirectPath(String(raw.returnTo ?? ""), "/opportunities"));
  revalidatePath("/dashboard/saved");
  return { status: "success", message: parsed.data.intent === "save" ? "Saved." : "Removed from saved." };
}
