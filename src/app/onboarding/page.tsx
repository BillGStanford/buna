import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Category, Profile } from "@/lib/types";
import { EcosystemOnboardingForm } from "@/components/forms/ecosystem-onboarding-form";

export const metadata: Metadata = { title: "Join the Buna ecosystem", robots: { index: false, follow: false } };

type Step = "identity" | "interests" | "pathway" | "investor";
const FOUNDER_ORDER: Step[] = ["identity", "interests", "pathway"];
const INVESTOR_ORDER: Step[] = ["identity", "interests", "investor"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile("/onboarding");
  const p = profile as Profile & { account_type?: string | null; onboarding_data?: Record<string, unknown> | null };
  const { step: requested } = await searchParams;
  if (p.onboarding_completed_at) redirect("/onboarding/complete");
  const step: Step = requested === "interests" ? "interests" : requested === "pathway" ? "pathway" : requested === "investor" ? "investor" : "identity";
  const savedStep = String(p.onboarding_data?.step ?? "identity");
  const accountType = p.account_type ?? null;
  const ORDER = accountType === "investor" ? INVESTOR_ORDER : FOUNDER_ORDER;
  const stepIndex = ORDER.indexOf(step);
  const savedIndex = ORDER.indexOf(savedStep as Step);
  if (stepIndex > Math.max(0, savedIndex)) redirect(`/onboarding?step=${savedStep}`);
  if (step === "investor" && accountType !== "investor") redirect("/onboarding?step=pathway");
  if (step === "pathway" && accountType === "investor") redirect("/onboarding?step=investor");

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, slug, name").eq("is_active", true).order("sort_order");
  const categories = (data ?? []) as Category[];
  const labels: Record<Step, { eyebrow: string; title: string; description: string }> = {
    identity: { eyebrow: "YOUR PLACE IN THE ECOSYSTEM · 01 / 03", title: "First, let’s introduce you.", description: "Create the public identity people will recognize when they discover your work on Buna." },
    interests: { eyebrow: "MAKE IT RELEVANT · 02 / 03", title: "Shape the ecosystem you see.", description: "Choose the sectors and places you care about. We’ll use these to make discovery more useful." },
    pathway: { eyebrow: "YOUR FOUNDER JOURNEY · 03 / 03", title: "Let’s get your company moving.", description: "Tell us whether you’re building something new, joining a team or exploring an idea." },
    investor: { eyebrow: "INVESTOR MODE APPLICATION · 03 / 03", title: "Show founders how you invest.", description: "Share your investment focus and contact preferences. Investor Mode access is reviewed separately." },
  };
  const meta = labels[step];
  const steps = accountType === "investor" ? ["identity", "interests", "investor"] : ["identity", "interests", "pathway"];
  const position = steps.indexOf(step) + 1;

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-primary-pale/50 py-8 sm:py-12">
      <div className="container-page max-w-3xl">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{meta.eyebrow}</p><p className="mt-1 text-xs text-muted">Your Buna setup is saved as you go.</p></div>
            <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">Step {position} of 3</span>
          </div>
          <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${position / 3 * 100}%` }} /></div>
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{meta.title}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{meta.description}</p>
            <div className="mt-7"><EcosystemOnboardingForm step={step} profile={p} categories={categories} /></div>
          </section>
          <p className="mx-auto mt-5 max-w-xl text-center text-xs leading-relaxed text-muted">Your progress is saved between steps. You control the information shown on your public profile; private application details are only shared with the Buna review team.</p>
        </div>
      </div>
    </main>
  );
}
