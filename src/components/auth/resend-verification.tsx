"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function ResendVerification({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, idleState);
  return (
    <form action={action} className="space-y-3 rounded-md border border-line bg-primary-pale p-4">
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-ink">Didn’t get the email? Check your spam folder, or send it again.</p>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Sending…">Resend confirmation email</SubmitButton>
    </form>
  );
}
