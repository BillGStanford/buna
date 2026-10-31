"use client";

import { useActionState } from "react";
import { requestVerificationAction, withdrawVerificationAction } from "@/app/dashboard/startup/verification-actions";
import { TextAreaField } from "@/components/ui/fields";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/types";

export function RequestVerificationForm({ startupId }: { startupId: string }) {
  const [state, action] = useActionState(requestVerificationAction, idleState);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} className="max-w-xl space-y-4" noValidate>
      <input type="hidden" name="startupId" value={startupId} />
      <FormMessage state={state} />
      <TextAreaField label="How can we check this startup?" name="notes" rows={5} required maxLength={2000}
        hint="For example: your company registration number and registry, an official website or social profile that names you, a business email domain, or a link to press coverage. You don’t need a registered company to be listed — this is only for the Verified badge."
        error={firstError(state, "notes")} />
      <div>
        <label htmlFor="evidence-files" className="mb-1.5 block text-sm font-medium">Documents (optional, up to 3)</label>
        <input id="evidence-files" name="evidence" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-primary-mint" />
        <p className="mt-1 text-xs text-muted">PDF, JPEG, PNG or WebP, up to 10 MB each. Stored privately — only your team and the Buna reviewers can open them; they’re never shown on your profile.</p>
      </div>
      <SubmitButton pendingLabel="Sending…">Request verification</SubmitButton>
    </form>
  );
}

export function WithdrawRequest({ startupId, requestId }: { startupId: string; requestId: string }) {
  return <ConfirmActionForm action={withdrawVerificationAction} fields={{ startupId, requestId }} trigger="Withdraw request" title="Withdraw this request?" description="Your documents stay private. You can ask again later." confirmLabel="Withdraw" />;
}
