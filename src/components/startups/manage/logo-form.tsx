"use client";

import { useActionState } from "react";
import { removeLogoAction, uploadLogoAction } from "@/app/dashboard/startup/actions";
import { StartupLogo } from "@/components/startups/startup-logo";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function LogoForm({ startupId, name, logoUrl, websiteUrl }: { startupId: string; name: string; logoUrl: string | null; websiteUrl?: string | null }) {
  const [state, action] = useActionState(uploadLogoAction, idleState);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <StartupLogo name={name} src={logoUrl} websiteUrl={websiteUrl} size={80} />
      <div className="space-y-3">
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="startupId" value={startupId} />
          <label htmlFor="logo-file" className="sr-only">Choose a logo image</label>
          <input id="logo-file" name="logo" type="file" accept="image/jpeg,image/png,image/webp" required
            className="block w-full max-w-xs text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-primary-mint" />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Uploading…">Upload logo</SubmitButton>
        </form>
        <p className="text-xs text-muted">Square works best. JPEG, PNG or WebP, up to 2 MB.</p>
        <FormMessage state={state} />
        {logoUrl ? (
          <ConfirmActionForm action={removeLogoAction} fields={{ startupId }} trigger="Remove logo" title="Remove logo?"
            description="Your startup will show its initial instead until you upload a new logo." confirmLabel="Remove logo" />
        ) : null}
      </div>
    </div>
  );
}
