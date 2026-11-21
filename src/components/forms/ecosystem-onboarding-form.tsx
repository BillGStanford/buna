"use client";

import { useActionState, useEffect, useState } from "react";
import { saveEcosystemOnboardingAction } from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { CountrySelect } from "@/components/forms/profile-fields";
import { idleState, type Category, type Profile } from "@/lib/types";
import { InvestorApplicationForm } from "@/components/investors/investor-forms";

type Step = "identity" | "interests" | "pathway" | "investor";
type ExtendedProfile = Profile & { account_type?: string | null; onboarding_data?: Record<string, unknown> | null; website_url?: string | null };
const stages = ["Pre-seed", "Seed", "Series A", "Series B+", "Growth", "Private equity"];
const geographies = ["Ethiopia", "East Africa", "West Africa", "North Africa", "Southern Africa", "Pan-African", "Global"];

function Field({ label, name, defaultValue = "", placeholder = "", type = "text", required = false }: { label: string; name: string; defaultValue?: string; placeholder?: string; type?: string; required?: boolean }) {
  return <label className="block text-sm font-medium text-ink">{label}{required ? <span className="ml-1 text-danger">*</span> : null}<input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>;
}

function Choice({ name, value, label, defaultChecked = false }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm hover:border-primary/50"><input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 accent-[rgb(var(--primary))]" />{label}</label>;
}

export function EcosystemOnboardingForm({ step, profile, categories, startupOptions }: { step: Step; profile: ExtendedProfile; categories: Category[]; startupOptions: { id: string; name: string }[] }) {
  const [state, action] = useActionState(saveEcosystemOnboardingAction, idleState);
  const saved = profile.onboarding_data ?? {};
  const [username, setUsername] = useState(profile.username?.startsWith("user-") ? "" : profile.username ?? "");
  const [usernameStatus, setUsernameStatus] = useState("Choose a username to check availability.");
  useEffect(() => {
    if (step !== "identity" || username.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setUsernameStatus("Checking availability…");
      try {
        const response = await fetch(`/api/onboarding/username?username=${encodeURIComponent(username)}`, { signal: controller.signal });
        const result = await response.json();
        setUsernameStatus(result.available ? "Username is available." : result.message ?? "That username is unavailable.");
      } catch { if (!controller.signal.aborted) setUsernameStatus("Could not check right now. We’ll verify when you continue."); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [username, step]);

  if (step === "investor") return <InvestorApplicationForm onboarding />;

  const commonHidden = <>
    <input type="hidden" name="accountType" value={profile.account_type ?? "founder_business"} />
    <input type="hidden" name="displayName" value={profile.display_name ?? ""} />
    <input type="hidden" name="username" value={profile.username ?? ""} />
  </>;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="step" value={step} />
      {step !== "identity" ? commonHidden : null}
      <FormMessage state={state} />
      {step === "identity" ? (
        <>
          <fieldset><legend className="text-sm font-semibold">How are you joining Buna?</legend><p className="mt-1 text-sm text-muted">Choose the path that best describes the role you want to play in this ecosystem.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="cursor-pointer rounded-xl border border-line bg-surface p-4 has-[:checked]:border-primary has-[:checked]:bg-primary-pale"><input type="radio" name="accountType" value="founder_business" defaultChecked={(profile.account_type ?? "founder_business") === "founder_business"} className="accent-[rgb(var(--primary))]" /><span className="ml-2 font-semibold">Founder / Business</span><p className="mt-2 text-sm text-muted">Build your company profile, find collaborators and launch to the ecosystem.</p></label>
              <label className="cursor-pointer rounded-xl border border-line bg-surface p-4 has-[:checked]:border-primary has-[:checked]:bg-primary-pale"><input type="radio" name="accountType" value="investor" defaultChecked={profile.account_type === "investor"} className="accent-[rgb(var(--primary))]" /><span className="ml-2 font-semibold">Investor</span><p className="mt-2 text-sm text-muted">Discover companies, share your investment focus and request Investor Mode.</p></label>
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your full name" name="displayName" defaultValue={profile.display_name} required />
            <label className="block text-sm font-medium text-ink">Username <span className="text-danger">*</span><input name="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} minLength={3} maxLength={24} required placeholder="yourname" className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><span className="mt-1 block text-xs text-muted" aria-live="polite">{usernameStatus}</span></label>
          </div>
          <Field label="Professional headline" name="headline" defaultValue={profile.headline ?? ""} placeholder="Founder building in fintech, Addis Ababa" />
          <Field label="Profile photo URL" name="avatarUrl" type="url" defaultValue={profile.avatar_url ?? ""} placeholder="https://…" />
          <p className="text-xs text-muted">Your name, username, headline, photo and public profile links can be visible to other Buna members. You can edit them later.</p>
          <SubmitButton size="lg" className="w-full" pendingLabel="Saving your profile…">Continue to your interests</SubmitButton>
        </>
      ) : null}

      {step === "interests" ? (
        <>
          <fieldset><legend className="text-sm font-semibold">What parts of the ecosystem interest you?</legend><p className="mt-1 text-sm text-muted">Choose at least one. We’ll use this to shape the companies, founders and opportunities you discover.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{categories.map((c) => <Choice key={c.slug} name="interests" value={c.slug} label={c.name} defaultChecked={profile.interests?.includes(c.slug)} />)}</div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><CountrySelect /><Field label="City / region" name="city" defaultValue={profile.city ?? ""} placeholder="Addis Ababa" /></div>
          <Field label="A little about you" name="bio" defaultValue={profile.bio ?? ""} placeholder="What are you working on or interested in?" />
          <Field label="Website" name="websiteUrl" type="url" defaultValue={profile.website_url ?? ""} placeholder="https://yourwebsite.com" />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="LinkedIn URL" name="linkedin" type="url" defaultValue={String((profile.social_links ?? {}).linkedin ?? "")} /><Field label="X profile URL" name="socialX" type="url" defaultValue={String((profile.social_links ?? {}).x ?? "")} /><Field label="Instagram URL" name="instagram" type="url" defaultValue={String((profile.social_links ?? {}).instagram ?? "")} /></div>
          <p className="text-xs text-muted">Location and social links are optional. Your country and city appear on your public profile according to your profile visibility settings.</p>
          <SubmitButton size="lg" className="w-full" pendingLabel="Saving your interests…">Continue</SubmitButton>
        </>
      ) : null}

      {step === "pathway" ? (
        <>
          <h2 className="text-lg font-bold">Where are you in your startup journey?</h2>
          <p className="text-sm text-muted">We’ll take you to the right next step, whether you’re already building or just getting started.</p>
          <fieldset className="space-y-3"><legend className="text-sm font-semibold">Which best describes your situation?</legend>
            {[["existing","I represent an existing startup"],["new","I’m creating a new startup"],["invite","I’m joining a company by invitation"],["exploring","I’m exploring before choosing a company"]].map(([v,l]) => <label key={v} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-pale"><input type="radio" name="founderPath" value={v} defaultChecked={saved.founder_path === v} className="accent-[rgb(var(--primary))]" /><span className="text-sm font-medium">{l}</span></label>)}
          </fieldset>
          {startupOptions.length || saved.founder_path === "existing" ? <label className="block text-sm font-medium text-ink">Existing startup <select name="startupId" defaultValue={String(saved.startup_id ?? "")} className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-primary"><option value="">Choose a startup you belong to</option>{startupOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><span className="mt-1 block text-xs text-muted">Only companies where you already have membership appear here. Ask a company admin to invite you if it is missing.</span></label> : null}
          <Field label="Your role in the company" name="founderStatus" defaultValue={profile.founder_status ?? ""} placeholder="Founder, co-founder, executive…" />
          <Field label="Your immediate goal" name="startupIntent" defaultValue={profile.startup_intent ?? ""} placeholder="Launch, find co-founders, raise funding…" />
          <p className="rounded-lg bg-primary-pale p-3 text-sm text-muted">For an existing company, you’ll select a company you already belong to. To join another company, its team admin must invite you. New founders will be guided into company creation.</p>
          <SubmitButton size="lg" className="w-full" pendingLabel="Setting up your founder workspace…">Continue to my founder workspace</SubmitButton>
        </>
      ) : null}

   </form>
  );
}
