import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/forms/onboarding-form";
import { skipOnboardingAction } from "./actions";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Set up your profile", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const profile = await requireProfile("/onboarding");
  if (profile.onboarding_completed_at) redirect("/dashboard/profile");

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, slug, name").eq("is_active", true).order("sort_order");
  const categories = (data ?? []) as Category[];

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="text-3xl font-bold">Welcome to Buna{profile.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}</h1>
      <p className="mt-2 text-muted">Tell us a little about yourself. Everything except your name and username is optional, and you can change it later.</p>
      <div className="mt-8">
        <OnboardingForm profile={profile} categories={categories} />
      </div>
      <form action={skipOnboardingAction} className="mt-6 border-t border-line pt-6">
        <p className="mb-3 text-sm text-muted">Not ready? You can finish this any time from your dashboard.</p>
        <Button type="submit" variant="ghost">Skip for now</Button>
      </form>
    </div>
  );
}
