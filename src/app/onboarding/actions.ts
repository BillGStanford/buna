"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import type { ActionState } from "@/lib/types";
import { countryField, optionalText } from "@/lib/validation/common";
import { z } from "zod";

const log = createLogger("onboarding");
const roles = ["Founder / Co-founder", "Investor", "Entrepreneur / Aspiring founder", "Developer / Technical professional", "Student", "Business professional", "Researcher / Academic", "Other"] as const;

export async function saveRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const role = String(formData.get("professionalRole") ?? "").trim();
  if (!roles.includes(role as (typeof roles)[number])) {
    return { status: "error", message: "Choose the role that best describes you." };
  }
  const profile = await requireActiveProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ professional_role: role }).eq("id", profile.id);
  if (error) {
    log.error("saving onboarding role failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t save that yet. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/onboarding?step=2");
}

const discoverySchema = z.object({
  interests: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1, "Choose at least one sector.").max(10, "Choose up to 10 sectors."),
  city: optionalText(80),
  country: countryField,
});

export async function saveDiscoveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    interests: formData.getAll("interests").map(String),
    city: String(formData.get("city") ?? ""),
    country: String(formData.get("country") ?? ""),
  };
  const parsed = discoverySchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your answers and try again." };

  const profile = await requireActiveProfile();
  if (!profile.professional_role) redirect("/onboarding");
  const supabase = await createClient();
  const { data: categories, error: categoryError } = await supabase
    .from("categories").select("slug").eq("is_active", true).in("slug", parsed.data.interests);
  if (categoryError || (categories?.length ?? 0) !== parsed.data.interests.length) {
    return { status: "error", message: "One or more sectors are no longer available. Refresh and choose again." };
  }

  const { error } = await supabase.from("profiles").update({
    interests: parsed.data.interests,
    city: parsed.data.city,
    country: parsed.data.country,
    onboarding_completed_at: new Date().toISOString(),
    onboarding_skipped_at: null,
  }).eq("id", profile.id);
  if (error) {
    log.error("saving discovery preferences failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t save your preferences. Please try again." };
  }
  revalidatePath("/", "layout");

  // Route members directly into the first meaningful action for their account type.
  if (profile.professional_role === "Investor") redirect("/dashboard/investor");
  if (profile.professional_role === "Founder / Co-founder" || profile.professional_role === "Entrepreneur / Aspiring founder") {
    const { data: membership } = await supabase.from("startup_members").select("startup_id").eq("user_id", profile.id).limit(1).maybeSingle();
    if (!membership) redirect("/dashboard/startup/new?welcome=1");
  }
  redirect("/dashboard");
}

/** Kept as a safe redirect for old links; activation requirements can no longer be skipped. */
export async function skipOnboardingAction(): Promise<void> {
  const profile = await requireActiveProfile();
  redirect(profile.professional_role ? "/onboarding?step=2" : "/onboarding");
}
