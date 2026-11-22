"use client";

import { useActionState, useEffect, useState } from "react";
import { saveEcosystemOnboardingAction } from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { CountrySelect } from "@/components/forms/profile-fields";
import { idleState, type Category, type Profile } from "@/lib/types";
import { InvestorApplicationForm } from "@/components/investors/investor-forms";
import { AvatarForm } from "@/components/forms/avatar-form";

type Step = "identity" | "interests" | "pathway" | "investor";
type ExtendedProfile = Profile & { account_type?: string | null; onboarding_data?: Record<string, unknown> | null; website_url?: string | null };

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
  const [invitationToken, setInvitationToken] = useState("");
  const [invitationStatus, setInvitationStatus] = useState("");
  const [invitedStartup, setInvitedStartup] = useState<{ id: string; name: string } | null>(null);
  const [selectedStartupId, setSelectedStartupId] = useState(String(saved.startup_id ?? ""));
  const [founderPath, setFounderPath] = useState(String(saved.founder_path ?? ""));
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

  useEffect(() => {
    const token = invitationToken.trim().match(/(?:\/invite\/)?([A-Za-z0-9_-]{43})/)?.[1] ?? invitationToken.trim();
    if (token.length !== 43) {
      setInvitedStartup(null);
      setInvitationStatus(invitationToken.trim() ? "Paste the complete invitation link or token." : "");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setInvitationStatus("Checking invitation…");
      try {
        const response = await fetch(`/api/onboarding/invitation-preview?token=${encodeURIComponent(token)}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.valid || !result.startup?.id) {
          setInvitedStartup(null);
          setInvitationStatus(result.message ?? "This invitation could not be verified.");
          return;
        }
        setInvitedStartup(result.startup);
        setSelectedStartupId(result.startup.id);
        setFounderPath("invite");
        setInvitationStatus(`Invitation verified — ${result.startup.name} is ready to join.`);
      } catch {
        if (!controller.signal.aborted) setInvitationStatus("Could not check this invitation right now. Try again.");
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [invitationToken]);

  if (step === "investor") return <InvestorApplicationForm onboarding />;

  const commonHidden = <>
    <input type="hidden" name="accountType" value={profile.account_type ?? "founder_business"} />
    <input type="hidden" name="displayName" value={profile.display_name ?? ""} />
    <input type="hidden" name="username" value={profile.username ?? ""} />
  </>;

  return (
    <>
      {step === "identity" ? <div className="mb-6 rounded-xl border border-line bg-canvas p-4"><p className="mb-3 text-sm font-semibold">Your profile photo</p><AvatarForm name={profile.display_name} avatarUrl={profile.avatar_url} /></div> : null}
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
          <p className="text-xs text-muted">Your name, username, headline, photo and public profile links can be visible to other Buna members. You can edit them later.</p>
          <SubmitButton size="lg" className="w-full" pendingLabel="Saving your profile…">Continue to your interests</SubmitButton>
        </>
      ) : null}

      {step === "interests" ? (
        <>
          <fieldset><legend className="text-sm font-semibold">What parts of the ecosystem interest you?</legend><p className="mt-1 text-sm text-muted">Choose at least one. We’ll use this to shape the companies, founders and opportunities you discover.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{categories.map((c) => <Choice key={c.slug} name="interests" value={c.slug} label={c.name} defaultChecked={profile.interests?.includes(c.slug)} />)}</div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><CountrySelect defaultValue={profile.country ?? ""} /><Field label="City / region" name="city" defaultValue={profile.city ?? ""} placeholder="Addis Ababa" /></div>
          <Field label="A little about you" name="bio" defaultValue={profile.bio ?? ""} placeholder="What are you working on or interested in?" />
          <Field label="Website" name="websiteUrl" type="url" defaultValue={profile.website_url ?? ""} placeholder="https://yourwebsite.com" />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="LinkedIn URL" name="linkedin" type="url" defaultValue={String((profile.social_links ?? {}).linkedin ?? "")} /><Field label="X profile URL" name="socialX" type="url" defaultValue={String((profile.social_links ?? {}).x ?? "")} /><Field label="Instagram URL" name="instagram" type="url" defaultValue={String((profile.social_links ?? {}).instagram ?? "")} /><Field label="GitHub URL" name="github" type="url" defaultValue={String((profile.social_links ?? {}).github ?? "")} /><Field label="YouTube URL" name="youtube" type="url" defaultValue={String((profile.social_links ?? {}).youtube ?? "")} /><Field label="TikTok URL" name="tiktok" type="url" defaultValue={String((profile.social_links ?? {}).tiktok ?? "")} /><Field label="Facebook URL" name="facebook" type="url" defaultValue={String((profile.social_links ?? {}).facebook ?? "")} /><Field label="Threads URL" name="threads" type="url" defaultValue={String((profile.social_links ?? {}).threads ?? "")} /></div>
          <p className="text-xs text-muted">Location and social links are optional. Your country and city appear on your public profile according to your profile visibility settings.</p>
          <SubmitButton size="lg" className="w-full" pendingLabel="Saving your interests…">Continue</SubmitButton>
        </>
      ) : null}

      {step === "pathway" ? (
        <>
          <h2 className="text-lg font-bold">Where are you in your startup journey?</h2>
          <p className="text-sm text-muted">We’ll take you to the right next step, whether you’re already building or just getting started.</p>
          <fieldset className="space-y-3"><legend className="text-sm font-semibold">Which best describes your situation?</legend>
            {[["existing","I represent an existing startup"],["new","I’m creating a new startup"],["invite","I’m joining a company by invitation"],["exploring","I’m exploring before choosing a company"]].map(([v,l]) => <label key={v} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-pale"><input type="radio" name="founderPath" value={v} checked={founderPath === v} onChange={() => setFounderPath(v)} className="accent-[rgb(var(--primary))]" /><span className="text-sm font-medium">{l}</span></label>)}
          </fieldset>
          <label className="block text-sm font-medium text-ink">Existing startup
            <select name="startupId" value={selectedStartupId} onChange={(event) => setSelectedStartupId(event.target.value)} disabled={startupOptions.length === 0 && !invitedStartup} className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-primary">
              <option value="">Choose a startup you belong to</option>
              {startupOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              {invitedStartup && !startupOptions.some((s) => s.id === invitedStartup.id) ? <option value={invitedStartup.id}>{invitedStartup.name} — invitation</option> : null}
            </select>
            <span className="mt-1 block text-xs text-muted">{invitedStartup ? "Your invited company has been added above. Submit to accept the invitation and join its team." : startupOptions.length ? "Choose a company where you already have membership, or paste an invitation below." : "No existing company memberships are linked to your profile. Paste your company invitation below to load it here."}</span>
          </label>
          <label className="block text-sm font-medium text-ink">Company invitation link or token
            <input name="invitationToken" value={invitationToken} onChange={(event) => setInvitationToken(event.target.value)} placeholder="Paste the /invite/… link or token from your company admin" className="mt-1.5 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            {invitationStatus ? <span className="mt-1 block text-xs text-muted" aria-live="polite">{invitationStatus}</span> : null}
          </label>
          <Field label="Your role in the company" name="founderStatus" defaultValue={profile.founder_status ?? ""} placeholder="Founder, co-founder, executive…" />
          <Field label="Your immediate goal" name="startupIntent" defaultValue={profile.startup_intent ?? ""} placeholder="Launch, find co-founders, raise funding…" />
          <p className="rounded-lg bg-primary-pale p-3 text-sm text-muted">For an existing company, you’ll select a company you already belong to. To join another company, its team admin must invite you. New founders will be guided into company creation.</p>
          <SubmitButton size="lg" className="w-full" pendingLabel="Setting up your founder workspace…">Continue to my founder workspace</SubmitButton>
        </>
      ) : null}

      </form>
    </>
  );
}
