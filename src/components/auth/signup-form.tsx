"use client";

import { useActionState } from "react";
import { signUpAction } from "@/app/(auth)/actions";
import Link from "next/link";
import { TextField, SelectField } from "@/components/ui/fields";
import { CountrySelect, FounderStatusSelect } from "@/components/forms/profile-fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";
import { STARTUP_INTENTS } from "@/lib/validation/profile";

export function SignupForm() {
  const [state, action] = useActionState(signUpAction, idleState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField label="Full name" name="displayName" autoComplete="name" required
        defaultValue={valueOf(state, "displayName")} error={firstError(state, "displayName")} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={valueOf(state, "email")} error={firstError(state, "email")} />

      <div className="rounded-lg border border-line bg-primary-pale/40 p-4">
        <h2 className="text-sm font-semibold text-ink">A little about you</h2>
        <p className="mt-1 text-xs text-muted">These quick details help Buna connect you with relevant founders, startups and opportunities. You can change them later.</p>
        <div className="mt-3 space-y-3">
          <CountrySelect defaultValue={valueOf(state, "country")} error={firstError(state, "country")} />
          <FounderStatusSelect defaultValue={valueOf(state, "founderStatus")} error={firstError(state, "founderStatus")} />
          <SelectField label="What do you want to do on Buna?" name="startupIntent"
            defaultValue={valueOf(state, "startupIntent")} error={firstError(state, "startupIntent")}>
            <option value="">Choose one (optional)</option>
            {STARTUP_INTENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
        </div>
      </div>

      <TextField label="Password" name="password" type="password" autoComplete="new-password" required
        hint="At least 10 characters." error={firstError(state, "password")} />
      <TextField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required
        error={firstError(state, "confirmPassword")} />
      <div>
        <div className="flex items-start gap-3">
          <input id="f-acceptTerms" type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 rounded border-line accent-[rgb(var(--primary))]" aria-describedby={firstError(state, "acceptTerms") ? "f-acceptTerms-error" : undefined} />
          <label htmlFor="f-acceptTerms" className="text-sm text-ink">
            I agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/guidelines" target="_blank">Community Guidelines</Link>, and have read the <Link href="/privacy" target="_blank">Privacy Policy</Link>.
          </label>
        </div>
        {firstError(state, "acceptTerms") ? <p id="f-acceptTerms-error" className="mt-1 text-xs font-medium text-danger">{firstError(state, "acceptTerms")}</p> : null}
      </div>
      <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
