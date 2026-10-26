"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, idleState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={valueOf(state, "email")} error={firstError(state, "email")} />
      <SubmitButton className="w-full" pendingLabel="Sending link…">Send reset link</SubmitButton>
    </form>
  );
}
