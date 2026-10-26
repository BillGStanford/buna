"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function ResetPasswordForm({ submitLabel = "Update password", action = resetPasswordAction }: {
  submitLabel?: string;
  action?: typeof resetPasswordAction;
}) {
  const [state, run] = useActionState(action, idleState);
  return (
    <form action={run} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required
        hint="At least 10 characters." error={firstError(state, "password")} />
      <TextField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required
        error={firstError(state, "confirmPassword")} />
      <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
