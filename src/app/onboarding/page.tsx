import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/forms/onboarding-form";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Set up your Buna experience", robots: { index: false, follow: false } };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const profile = await requireProfile("/onboarding");
  const step = (await searchParams).step;
  if (!profile.professional_role) {
    // Step one is the only requirement before the member may enter the dashboard.
  } else if ((profile.interests?.length ?? 0) > 0) {
    redirect("/dashboard");
  }

  const activeStep = profile.professional_role ? 2 : 1;
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, slug, name").eq("is_active", true).order("sort_order");
  const categories = (data ?? []) as Category[];

  return (
    <div className="container-page max-w-2xl py-10">
      <p className="text-sm font-semibold text-primary">GETTING STARTED · STEP {activeStep} OF 2</p>
      <h1 className="mt-2 text-3xl font-bold">{activeStep === 1 ? "Let’s make Buna relevant to you." : "What do you want to discover?"}</h1>
      <p className="mt-2 text-muted">
        {activeStep === 1
          ? "First, tell us your professional role. This helps us introduce you to the right people and opportunities."
          : "Choose at least one sector so we can personalize the startups and founders you see. Your city is optional."}
      </p>
      <div className="mt-8">
        <OnboardingForm step={activeStep} profile={profile} categories={categories} />
      </div>
      {activeStep === 2 ? <p className="mt-5 text-sm text-muted">You can browse Buna without sharing your location. City and country are optional and can be added later.</p> : null}
    </div>
  );
}
