"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/dashboard/profile/actions";
import { TextField, TextAreaField, CheckboxField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { CountrySelect, FounderStatusSelect } from "@/components/forms/profile-fields";
import { idleState, type Category, type Profile } from "@/lib/types";
import { WebsiteUrlField } from "@/components/websites/website-url-field";
import { OPEN_TO } from "@/lib/people/params";

export function ProfileForm({ profile, categories }: { profile: Profile; categories: Category[] }) {
  const [state, action] = useActionState(updateProfileAction, idleState);
  const err = state.status === "error";
  const pick = (key: string, fallback: string) => (err ? valueOf(state, key, fallback) : fallback);
  const selected = err && Array.isArray(state.values?.interests) ? (state.values.interests as string[]) : profile.interests;

  return (
    <form action={action} className="space-y-8" noValidate>
      <FormMessage state={state} />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" name="displayName" required defaultValue={pick("displayName", profile.display_name)} error={firstError(state, "displayName")} />
          <TextField label="Username" name="username" required autoCapitalize="none" spellCheck={false}
            defaultValue={pick("username", profile.username)} error={firstError(state, "username")} />
        </div>
        <TextField label="Headline" name="headline" hint="One line under your name, e.g. “Building payments for small shops”."
          defaultValue={pick("headline", profile.headline ?? "")} error={firstError(state, "headline")} />
        <TextAreaField label="Bio" name="bio" rows={4} hint="Up to 500 characters."
          defaultValue={pick("bio", profile.bio ?? "")} error={firstError(state, "bio")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CountrySelect defaultValue={pick("country", profile.country ?? "")} error={firstError(state, "country")} />
          <TextField label="City" name="city" defaultValue={pick("city", profile.city ?? "")} error={firstError(state, "city")} />
        </div>
        <TextField label="What do you do?" name="professionalRole" defaultValue={pick("professionalRole", profile.professional_role ?? "")} error={firstError(state, "professionalRole")} />
        <FounderStatusSelect defaultValue={pick("founderStatus", profile.founder_status ?? "")} error={firstError(state, "founderStatus")} />
        <WebsiteUrlField label="Website" name="websiteUrl" placeholder="https://" defaultValue={pick("websiteUrl", profile.website_url ?? "")} error={firstError(state, "websiteUrl")} />
        <TextField label="Expertise" name="expertise" hint="Comma-separated, up to 10. For example: payments, growth, Flutter."
          defaultValue={pick("expertise", profile.expertise.join(", "))} error={firstError(state, "expertise")} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Social media</h2>
          <p className="mt-1 text-sm text-muted">Add the profiles you want people to find. These links appear on your public Buna profile when your profile is public.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="LinkedIn" name="socialLinkedin" type="url" inputMode="url" placeholder="https://www.linkedin.com/in/your-name"
            defaultValue={pick("socialLinkedin", profile.social_links?.linkedin ?? "")} error={firstError(state, "socialLinkedin")} />
          <TextField label="X / Twitter" name="socialX" type="url" inputMode="url" placeholder="https://x.com/yourname"
            defaultValue={pick("socialX", profile.social_links?.x ?? "")} error={firstError(state, "socialX")} />
          <TextField label="GitHub" name="socialGithub" type="url" inputMode="url" placeholder="https://github.com/yourname"
            defaultValue={pick("socialGithub", profile.social_links?.github ?? "")} error={firstError(state, "socialGithub")} />
          <TextField label="Instagram" name="socialInstagram" type="url" inputMode="url" placeholder="https://instagram.com/yourname"
            defaultValue={pick("socialInstagram", profile.social_links?.instagram ?? "")} error={firstError(state, "socialInstagram")} />
          <TextField label="YouTube" name="socialYoutube" type="url" inputMode="url" placeholder="https://youtube.com/@yourname"
            defaultValue={pick("socialYoutube", profile.social_links?.youtube ?? "")} error={firstError(state, "socialYoutube")} />
          <TextField label="TikTok" name="socialTiktok" type="url" inputMode="url" placeholder="https://tiktok.com/@yourname"
            defaultValue={pick("socialTiktok", profile.social_links?.tiktok ?? "")} error={firstError(state, "socialTiktok")} />
          <TextField label="Facebook" name="socialFacebook" type="url" inputMode="url" placeholder="https://facebook.com/yourname"
            defaultValue={pick("socialFacebook", profile.social_links?.facebook ?? "")} error={firstError(state, "socialFacebook")} />
          <TextField label="Threads" name="socialThreads" type="url" inputMode="url" placeholder="https://threads.net/@yourname"
            defaultValue={pick("socialThreads", profile.social_links?.threads ?? "")} error={firstError(state, "socialThreads")} />
        </div>
      </section>

      {categories.length > 0 ? (
        <fieldset>
          <legend className="text-lg font-semibold">Interests</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {categories.map((c) => (
              <CheckboxField key={c.slug} id={`interest-${c.slug}`} name="interests" value={c.slug} label={c.name} defaultChecked={selected.includes(c.slug)} />
            ))}
          </div>
          {firstError(state, "interests") ? <p className="mt-2 text-xs font-medium text-danger">{firstError(state, "interests")}</p> : null}
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="text-lg font-semibold">Open to</legend>
        <p className="mt-1 text-sm text-muted">Shown in the founder directory if you choose to be listed.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {OPEN_TO.map((o) => <CheckboxField key={o.value} id={`open-${o.value}`} name="openTo" value={o.value} label={o.label} defaultChecked={(err && Array.isArray(state.values?.openTo) ? (state.values.openTo as string[]) : profile.open_to).includes(o.value)} />)}
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-line bg-primary-pale p-4">
        <legend className="px-1 text-lg font-semibold">What’s public</legend>
        <p className="text-sm text-muted">Your name, username and photo identify you on Buna. Everything else stays private unless you turn it on here.</p>
        <CheckboxField name="isPublicProfile" label="Show my bio, headline, website and social links on my public profile" defaultChecked={profile.is_public_profile} />
        <CheckboxField name="showLocation" label="Show my country and city" defaultChecked={profile.show_location} />
        <CheckboxField name="isDiscoverableFounder" label="List me in the founder directory"
          hint="Needs a public profile. Your email and phone are never shown." defaultChecked={profile.is_discoverable_founder} />
        {firstError(state, "isDiscoverableFounder") ? <p className="text-xs font-medium text-danger">{firstError(state, "isDiscoverableFounder")}</p> : null}
      </fieldset>

      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
