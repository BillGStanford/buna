"use client";

import { useActionState } from "react";
import { completeOnboardingAction } from "@/app/onboarding/actions";
import { TextField, SelectField, CheckboxField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { CountrySelect, FounderStatusSelect } from "@/components/forms/profile-fields";
import { STARTUP_INTENTS } from "@/lib/validation/profile";
import { idleState, type Category, type Profile } from "@/lib/types";

export function OnboardingForm({ profile, categories }: { profile: Profile; categories: Category[] }) {
  const [state, action] = useActionState(completeOnboardingAction, idleState);
  const err = state.status === "error";
  const pick = (key: string, fallback: string) => (err ? valueOf(state, key, fallback) : fallback);
  const selected = err && Array.isArray(state.values?.interests) ? (state.values.interests as string[]) : profile.interests;
  const username = profile.username.startsWith("user-") ? "" : profile.username;

  return (
    <form action={action} className="space-y-8" noValidate>
      <FormMessage state={state} />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">About you</h2>
        <TextField label="Full name" name="displayName" required autoComplete="name"
          defaultValue={pick("displayName", profile.display_name)} error={firstError(state, "displayName")} />
        <TextField label="Username" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false}
          hint="Your public handle. Letters, numbers, dashes and underscores."
          defaultValue={pick("username", username)} error={firstError(state, "username")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CountrySelect defaultValue={pick("country", profile.country ?? "")} error={firstError(state, "country")} />
          <TextField label="City" name="city" autoComplete="address-level2"
            defaultValue={pick("city", profile.city ?? "")} error={firstError(state, "city")} />
        </div>
        <TextField label="What do you do?" name="professionalRole" hint="For example: Founder & CEO, Product designer, Angel investor."
          defaultValue={pick("professionalRole", profile.professional_role ?? "")} error={firstError(state, "professionalRole")} />
        <FounderStatusSelect defaultValue={pick("founderStatus", profile.founder_status ?? "")} error={firstError(state, "founderStatus")} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">What brings you to Buna?</h2>
        <SelectField label="I want to…" name="startupIntent" defaultValue={pick("startupIntent", profile.startup_intent ?? "")}
          error={firstError(state, "startupIntent")}>
          <option value="">Choose one (optional)</option>
          {STARTUP_INTENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </SelectField>
        {categories.length > 0 ? (
          <fieldset>
            <legend className="text-sm font-medium">Areas you care about <span className="font-normal text-muted">(up to 10)</span></legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {categories.map((c) => (
                <CheckboxField key={c.slug} id={`interest-${c.slug}`} name="interests" value={c.slug} label={c.name}
                  defaultChecked={selected.includes(c.slug)} />
              ))}
            </div>
            {firstError(state, "interests") ? <p className="mt-2 text-xs font-medium text-danger">{firstError(state, "interests")}</p> : null}
          </fieldset>
        ) : null}
      </section>

      <SubmitButton size="lg" pendingLabel="Saving…">Save and continue</SubmitButton>
    </form>
  );
}
