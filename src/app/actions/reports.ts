"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { reportSchema } from "@/lib/validation/startup";
import type { ActionState } from "@/lib/types";

const log = createLogger("reports");

/** Files a report against a startup, launch, comment or user. One report per person per target. */
export async function reportContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = reportSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  if (!(await rateLimit(`report:${profile.id}`, 10, 3600))) {
    return { status: "error", message: "You’ve sent several reports recently. Please try again later." };
  }
  const { targetType, targetId, reason, details } = parsed.data;
  const supabase = await createClient();

  // The target must exist and be visible to the reporter (row-level security applies to these reads).
  const source = { startup: "startups", launch: "launches", comment: "comments", user: "public_profiles", opportunity: "opportunities", investor: "investors" }[targetType];
  const { data: target } = await supabase.from(source).select("id").eq("id", targetId).maybeSingle();
  if (!target) return { status: "error", message: "That content isn’t available any more." };

  const { error } = await supabase.from("reports").insert({ reporter_id: profile.id, target_type: targetType, target_id: targetId, reason, details });
  if (error) {
    if (error.code === "23505") return { status: "success", message: "You’ve already reported this. Our team will review it." };
    log.error("report insert failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t send your report. Please try again." };
  }
  return { status: "success", message: "Thanks — our team will review this." };
}
