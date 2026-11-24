"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import type { ActionState } from "@/lib/types";
import { countryField, optionalText } from "@/lib/validation/common";
import { z } from "zod";
import { recordPlatformEvent } from "@/lib/analytics/platform";
import { sha256Hex } from "@/lib/crypto";
import { getFounderPathProfileValues } from "@/lib/onboarding/founder-path";

const log = createLogger("onboarding");

function onboardingSchemaNotApplied(error: { code?: string; message?: string; details?: string | null }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205" ||
    (text.includes("onboarding_data") || text.includes("account_type")) && (text.includes("column") || text.includes("schema cache"));
}

function onboardingSaveError(error: { code?: string; message?: string; details?: string | null }, fallback: string) {
  if (onboardingSchemaNotApplied(error)) {
    return "Buna’s database schema is behind the onboarding code. Apply the latest Supabase migrations (npx supabase db push), then retry.";
  }
  if (error.code === "42501") {
    return "Buna’s database permissions are behind the onboarding code. Apply the latest Supabase migrations (npx supabase db push), then retry.";
  }
  return fallback;
}
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
  const wasAlreadyOnboarded = Boolean(profile.onboarding_completed_at);
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
  if (!wasAlreadyOnboarded) await recordPlatformEvent("onboarding_completed", "/onboarding");
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


const ecosystemOnboardingSchema = z.object({
  step: z.enum(["identity", "interests", "pathway", "investor"]),
  accountType: z.enum(["founder_business", "investor"]),
  displayName: z.string().trim().min(2).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 letters, numbers or underscores."),
  headline: optionalText(120),
  bio: optionalText(500),
  avatarUrl: z.union([z.literal(""), z.string().url().max(500)]),
  websiteUrl: z.union([z.literal(""), z.string().url().max(300)]),
  country: countryField,
  city: optionalText(80),
  interests: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(10),
  founderStatus: optionalText(80),
  startupIntent: optionalText(80),
  founderPath: z.enum(["existing", "new", "invite", "exploring"]).optional(),
  startupId: z.string().uuid().optional().or(z.literal("")),
  invitationToken: z.string().trim().max(500).optional(),
  investorThesis: optionalText(2000),
  investmentStages: z.array(z.string().max(40)).max(8),
  investmentGeographies: z.array(z.string().max(80)).max(20),
  investmentSectors: z.array(z.string().max(80)).max(10),
  investmentMin: z.union([z.literal(""), z.coerce.number().min(0).max(1000000000)]),
  investmentMax: z.union([z.literal(""), z.coerce.number().min(0).max(1000000000)]),
  contactEmail: z.union([z.literal(""), z.string().email().max(254)]),
  contactPhone: optionalText(40),
  contactWhatsapp: optionalText(80),
  contactTelegram: optionalText(80),
  contactFacebook: z.union([z.literal(""), z.string().url().max(300)]),
  contactOtherUrl: z.union([z.literal(""), z.string().url().max(300)]),
});

export async function saveEcosystemOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    step: String(formData.get("step") ?? ""),
    accountType: String(formData.get("accountType") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    username: String(formData.get("username") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    country: String(formData.get("country") ?? ""),
    city: String(formData.get("city") ?? ""),
    interests: formData.getAll("interests").map(String),
    founderStatus: String(formData.get("founderStatus") ?? ""),
    startupIntent: String(formData.get("startupIntent") ?? ""),
    founderPath: String(formData.get("founderPath") ?? "") || undefined,
    startupId: String(formData.get("startupId") ?? ""),
    invitationToken: String(formData.get("invitationToken") ?? ""),
    investorThesis: String(formData.get("investorThesis") ?? ""),
    investmentStages: formData.getAll("investmentStages").map(String),
    investmentGeographies: formData.getAll("investmentGeographies").map(String),
    investmentSectors: formData.getAll("investmentSectors").map(String),
    investmentMin: String(formData.get("investmentMin") ?? ""),
    investmentMax: String(formData.get("investmentMax") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactWhatsapp: String(formData.get("contactWhatsapp") ?? ""),
    contactTelegram: String(formData.get("contactTelegram") ?? ""),
    contactFacebook: String(formData.get("contactFacebook") ?? ""),
    contactOtherUrl: String(formData.get("contactOtherUrl") ?? ""),
  };
  const parsed = ecosystemOnboardingSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the highlighted details and try again." };

  const profile = await requireActiveProfile();
  const value = parsed.data;
  const supabase = await createClient();

  if (value.step === "identity") {
    const { data: existing, error: usernameError } = await supabase.from("profiles").select("id").eq("username", value.username).neq("id", profile.id).maybeSingle();
    if (usernameError) {
      log.error("checking onboarding username failed", usernameError);
      return { status: "error", message: "We couldn’t check that username. Please try again." };
    }
    if (existing) return { status: "error", message: "That username is already taken. Try another one." };
    const { error } = await supabase.from("profiles").update({
      account_type: value.accountType,
      display_name: value.displayName,
      username: value.username,
      headline: value.headline || null,
      bio: value.bio || null,
      website_url: value.websiteUrl || null,
      professional_role: value.accountType === "investor" ? "Investor" : "Founder / Co-founder",
      onboarding_data: { ...(profile as unknown as { onboarding_data?: Record<string, unknown> }).onboarding_data, step: "interests" },
    }).eq("id", profile.id);
    if (error) {
      log.error("saving onboarding identity failed", error, { code: error.code });
      return { status: "error", message: error.code === "23505" ? "That username is already taken. Try another one." : onboardingSaveError(error, "We couldn’t save your profile. Please try again.") };
    }
    redirect("/onboarding?step=interests");
  }

  if (value.step === "interests") {
    if (value.interests.length < 1) return { status: "error", message: "Choose at least one interest to personalize your Buna experience." };
    const { data: categories, error: categoryError } = await supabase.from("categories").select("slug").eq("is_active", true).in("slug", value.interests);
    if (categoryError || (categories?.length ?? 0) !== value.interests.length) return { status: "error", message: "One or more interests are unavailable. Refresh and try again." };
    const { error } = await supabase.from("profiles").update({
      interests: value.interests, country: value.country, city: value.city || null, bio: value.bio || null, website_url: value.websiteUrl || null,
      social_links: {
        website: value.websiteUrl || "",
        linkedin: String(formData.get("linkedin") ?? "").trim(),
        x: String(formData.get("socialX") ?? "").trim(),
        instagram: String(formData.get("instagram") ?? "").trim(),
        github: String(formData.get("github") ?? "").trim(),
        youtube: String(formData.get("youtube") ?? "").trim(),
        tiktok: String(formData.get("tiktok") ?? "").trim(),
        facebook: String(formData.get("facebook") ?? "").trim(),
        threads: String(formData.get("threads") ?? "").trim(),
      },
      onboarding_data: { ...(profile as unknown as { onboarding_data?: Record<string, unknown> }).onboarding_data, step: profile.account_type === "investor" ? "investor" : "pathway" },
    }).eq("id", profile.id);
    if (error) {
      log.error("saving onboarding interests failed", error);
      return { status: "error", message: onboardingSaveError(error, "We couldn’t save your interests. Please try again.") };
    }
    redirect("/onboarding?step=pathway");
  }

  if (value.step === "pathway") {
    const accountType = (profile as unknown as { account_type?: string }).account_type;
    if (accountType === "founder_business") {
      if (!value.founderPath) return { status: "error", message: "Choose how you’re connected to a startup." };
      if (value.founderPath === "existing" && !value.startupId) return { status: "error", message: "Select the startup you represent." };
      if (value.founderPath === "invite" && !value.invitationToken) return { status: "error", message: "Paste the invitation link or token sent by the company admin." };
      const invitationToken = value.invitationToken?.match(/(?:\/invite\/)?([A-Za-z0-9_-]{43})/)?.[1];
      if (value.founderPath === "invite" && !invitationToken) return { status: "error", message: "That invitation link or token is not valid. Ask your company admin to resend it." };
      if (value.founderPath === "existing" && value.startupId) {
        const { data: membership, error: membershipError } = await supabase
          .from("startup_members")
          .select("startup_id")
          .eq("user_id", profile.id)
          .eq("startup_id", value.startupId)
          .maybeSingle();
        if (membershipError) {
          log.error("checking existing startup membership failed", membershipError, { code: membershipError.code, startupId: value.startupId });
          return { status: "error", message: "We couldn’t verify your membership. Refresh and try again." };
        }
        if (!membership) return { status: "error", message: "You can only select a startup you’re already a member of. Ask an admin for an invitation to join another company." };
      }
      // Accept the invitation as part of onboarding. This creates the startup_members
      // row through the same one-time, email-verified RPC used by the invite page.
      // The invited company therefore appears immediately after this step completes.
      let invitedStartupId: string | null = null;
      if (value.founderPath === "invite" && invitationToken) {
        const { data, error: invitationError } = await supabase.rpc("accept_team_invitation", {
          p_token_hash: sha256Hex(invitationToken),
        });
        if (invitationError || !data) {
          const message = invitationError?.message ?? "";
          if (message.includes("email_mismatch")) return { status: "error", message: "This invitation belongs to a different email address. Sign in with the email address it was sent to." };
          if (message.includes("email_not_verified")) return { status: "error", message: "Verify your email address before accepting this company invitation." };
          if (message.includes("invitation_expired")) return { status: "error", message: "This invitation has expired. Ask the company admin to send a new one." };
          if (message.includes("invitation_used")) return { status: "error", message: "This invitation has already been used or withdrawn." };
          log.error("accepting onboarding company invitation failed", invitationError, { code: invitationError?.code });
          return { status: "error", message: "We couldn’t match that invitation to your account. Check the link or code and try again." };
        }
        invitedStartupId = String(data);
      }

      // A new founder must create the actual company record before onboarding is marked
      // complete. The existing startup-creation form captures the essential fields and
      // creates the owner membership; do not send them through a generic completion page.
      const nextStep = value.founderPath === "new" ? "startup_basics" : "complete";
      // These profile columns have database CHECK constraints. Never write free-form
      // UI labels into them; retain the member's exact answers in onboarding_data.
      const profileValues = getFounderPathProfileValues(value.founderPath);
      const { error } = await supabase.from("profiles").update({
        founder_status: profileValues.founderStatus,
        startup_intent: profileValues.startupIntent,
        onboarding_data: {
          ...(profile as unknown as { onboarding_data?: Record<string, unknown> }).onboarding_data,
          founder_path: value.founderPath,
          founder_role_label: value.founderStatus || null,
          startup_goal: value.startupIntent || null,
          startup_id: invitedStartupId ?? (value.startupId || null),
          step: nextStep,
        },
        ...(value.founderPath === "new" ? {} : { onboarding_completed_at: new Date().toISOString() }),
      }).eq("id", profile.id);
      if (error) {
        log.error("saving onboarding founder pathway failed", error, {
          code: error.code,
          details: error.details,
          founderPath: value.founderPath,
          startupId: invitedStartupId ?? value.startupId ?? null,
        });
        return { status: "error", message: onboardingSaveError(error, "We couldn’t save your founder setup. Your answers have not been completed. Please retry.") };
      }
      revalidatePath("/", "layout");
      if (invitedStartupId) {
        revalidatePath("/dashboard/startup");
        revalidatePath(`/dashboard/startup/${invitedStartupId}`);
        redirect(`/dashboard/startup/${invitedStartupId}`);
      }
      if (value.founderPath === "new") redirect("/dashboard/startup/new?welcome=1");
      if (value.founderPath === "existing") {
        revalidatePath(`/dashboard/startup/${value.startupId}`);
        redirect(`/dashboard/startup/${value.startupId}`);
      }
      redirect("/dashboard");
    }
    const { error: stepError } = await supabase.from("profiles").update({
      onboarding_data: { ...(profile as unknown as { onboarding_data?: Record<string, unknown> }).onboarding_data, step: "investor" },
    }).eq("id", profile.id);
    if (stepError) return { status: "error", message: "We couldn’t save your progress. Please try again." };
    redirect("/onboarding?step=investor");
  }

  const accountType = (profile as unknown as { account_type?: string }).account_type;
  if (accountType !== "investor") redirect("/onboarding");
  if (!value.investorThesis || value.investmentStages.length === 0 || value.investmentGeographies.length === 0) {
    return { status: "error", message: "Add your investment thesis, at least one stage and one geographic focus." };
  }
  if (value.investmentMin !== "" && value.investmentMax !== "" && Number(value.investmentMin) > Number(value.investmentMax)) {
    return { status: "error", message: "Your maximum investment must be greater than or equal to your minimum." };
  }
  const contacts = [value.contactEmail, value.contactPhone, value.contactWhatsapp, value.contactTelegram, value.contactFacebook, value.contactOtherUrl];
  if (!contacts.some(Boolean)) return { status: "error", message: "Provide at least one way for founders to contact you." };

  const application = {
    user_id: profile.id,
    thesis: value.investorThesis,
    investment_stages: value.investmentStages,
    investment_geographies: value.investmentGeographies,
    investment_sectors: value.investmentSectors,
    investment_min: value.investmentMin === "" ? null : Number(value.investmentMin),
    investment_max: value.investmentMax === "" ? null : Number(value.investmentMax),
    contact_email: value.contactEmail || null,
    contact_phone: value.contactPhone || null,
    contact_whatsapp: value.contactWhatsapp || null,
    contact_telegram: value.contactTelegram || null,
    contact_facebook: value.contactFacebook || null,
    contact_other_url: value.contactOtherUrl || null,
  };
  const { data: prior, error: lookupError } = await supabase.from("investor_applications").select("id,status").eq("user_id", profile.id).maybeSingle();
  if (lookupError) {
    log.error("looking up investor application failed", lookupError);
    return { status: "error", message: "We couldn’t check your application status. Please try again." };
  }
  const { error: applicationError } = prior
    ? await supabase.from("investor_applications").update(application).eq("id", prior.id)
    : await supabase.from("investor_applications").insert(application);
  if (applicationError) {
    log.error("saving investor onboarding application failed", applicationError, { code: applicationError.code });
    return { status: "error", message: "We couldn’t submit your Investor Mode application. Please try again." };
  }
  const { error: profileError } = await supabase.from("profiles").update({
    onboarding_data: { ...(profile as unknown as { onboarding_data?: Record<string, unknown> }).onboarding_data, step: "complete" },
    onboarding_completed_at: new Date().toISOString(),
  }).eq("id", profile.id);
  if (profileError) return { status: "error", message: "Your application was saved, but we couldn’t finish onboarding. Please refresh." };
  revalidatePath("/", "layout");
  redirect("/dashboard/investor");
}
