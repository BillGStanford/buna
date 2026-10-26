"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/app/dashboard/settings/actions";
import { TextField } from "@/components/ui/fields";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/types";

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action] = useActionState(deleteAccountAction, idleState);
  return (
    <form action={action} className="max-w-lg space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField label={`Type your username (${username}) to confirm`} name="confirmUsername" autoCapitalize="none" spellCheck={false} autoComplete="off" required error={firstError(state, "confirmUsername")} />
      <TextField label="Your password" name="password" type="password" autoComplete="current-password" required error={firstError(state, "password")} />
      <SubmitButton variant="danger" pendingLabel="Deleting…">Permanently delete my account</SubmitButton>
    </form>
  );
}
