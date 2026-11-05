"use client";

import { useActionState } from "react";
import { saveDiscoveryAction, saveRoleAction } from "@/app/onboarding/actions";
import { TextField, SelectField, CheckboxField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { CountrySelect } from "@/components/forms/profile-fields";
import { idleState, type Category, type Profile } from "@/lib/types";

const ROLES = [
  "Founder / Co-founder",
  "Investor",
  "Entrepreneur / Aspiring founder",
  "Developer / Technical professional",
  "Student",
  "Business professional",
  "Researcher / Academic",
  "Other",
];

export function OnboardingForm({ step, profile, categories }: { step: 1 | 2; profile: Profile; categories: Category[] }) {
  const [roleState, roleAction] = useActionState(saveRoleAction, idleState);
  const [discoveryState, discoveryAction] = useActionState(saveDiscoveryAction, idleState);

  if (step === 1) {
    return (
      <form action={roleAction} className="space-y-6">
        <FormMessage state={roleState} />
        <SelectField label="What best describes your professional role?" name="professionalRole" required defaultValue={profile.professional_role ?? ""}>
          <option value="">Choose your role</option>
          {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
        </SelectField>
        <SubmitButton size="lg" className="w-full" pendingLabel="Saving…">Continue</SubmitButton>
      </form>
    );
  }

  return (
    <form action={discoveryAction} className="space-y-7">
      <FormMessage state={discoveryState} />
      <fieldset>
        <legend className="text-sm font-semibold">Which sectors interest you? <span className="text-danger">*</span></legend>
        <p className="mt-1 text-sm text-muted">Choose at least one. You can select up to 10 and change them any time.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <CheckboxField key={category.slug} id={`onboarding-interest-${category.slug}`} name="interests" value={category.slug}
              label={category.name} defaultChecked={profile.interests?.includes(category.slug)} />
          ))}
        </div>
        {categories.length === 0 ? <p className="mt-3 text-sm text-danger">Sectors are temporarily unavailable. Please try again later.</p> : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <CountrySelect />
        <TextField label="City (optional)" name="city" autoComplete="address-level2" defaultValue={profile.city ?? ""} />
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel="Personalizing your Buna…">Unlock personalized discovery</SubmitButton>
    </form>
  );
}
