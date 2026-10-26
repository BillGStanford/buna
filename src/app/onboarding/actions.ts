"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { onboardingSchema } from "@/lib/validation/profile";
import type { ActionState } from "@/lib/types";

const log = createLogger("onboarding");

export async function completeOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData, ["interests"]);
  const values = {
    displayName: String(raw.displayName ?? ""), username: String(raw.username ?? ""), country: String(raw.country ?? ""),
    city: String(raw.city ?? ""), professionalRole: String(raw.professionalRole ?? ""),
    founderStatus: String(raw.founderStatus ?? ""), startupIntent: String(raw.startupIntent ?? ""),
    interests: (raw.interests as string[]) ?? [],
  };
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: d.displayName, username: d.username, country: d.country, city: d.city,
      professional_role: d.professionalRole, founder_status: d.founderStatus, startup_intent: d.startupIntent,
      interests: d.interests, onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    if (error.code === "23505") return { status: "error", fieldErrors: { username: ["That username is taken. Try another."] }, values };
    log.error("onboarding update failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t save your details. Please try again.", values };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Optional steps can be skipped; the dashboard keeps a visible “finish your profile” checklist. */
export async function skipOnboardingAction(): Promise<void> {
  const profile = await requireActiveProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ onboarding_skipped_at: new Date().toISOString() }).eq("id", profile.id);
  if (error) log.error("skip onboarding failed", error, { code: error.code });
  redirect("/dashboard");
}
