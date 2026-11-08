"use client";

import { useActionState } from "react";
import { removeLogoAction, setLogoFromUrlAction, uploadLogoAction } from "@/app/dashboard/startup/actions";
import { StartupLogo } from "@/components/startups/startup-logo";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function LogoForm({ startupId, name, logoUrl, websiteUrl }: { startupId: string; name: string; logoUrl: string | null; websiteUrl?: string | null }) {
  const [fileState, fileAction] = useActionState(uploadLogoAction, idleState);
  const [urlState, urlAction] = useActionState(setLogoFromUrlAction, idleState);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="space-y-2">
        <StartupLogo name={name} src={logoUrl} websiteUrl={websiteUrl} size={88} />
        <p className="text-xs text-muted">Current logo</p>
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Choose an image from your device</h3>
          <form action={fileAction} className="space-y-2">
            <input type="hidden" name="startupId" value={startupId} />
            <label htmlFor="logo-file" className="sr-only">Choose a logo image</label>
            <input
              id="logo-file"
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(event) => {
                if (event.currentTarget.files?.length) event.currentTarget.form?.requestSubmit();
              }}
              className="block w-full max-w-sm text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-primary-mint"
            />
          </form>
          <p className="text-xs text-muted">JPEG, PNG or WebP. Maximum 2 MB. The image uploads automatically after you select it.</p>
          <FormMessage state={fileState} />
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">Or paste an image link</h3>
          <form action={urlAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="startupId" value={startupId} />
            <div className="min-w-0 flex-1">
              <label htmlFor="logo-url" className="mb-1 block text-xs text-muted">Image URL</label>
              <input
                id="logo-url"
                name="logoUrl"
                type="url"
                inputMode="url"
                placeholder="https://example.com/your-logo.png"
                required
                maxLength={300}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">Use image link</SubmitButton>
          </form>
          <p className="text-xs text-muted">Paste a direct, publicly accessible image URL. The saved image will appear on your startup profile.</p>
          <FormMessage state={urlState} />
        </section>

        {logoUrl ? (
          <div className="border-t border-line pt-3">
            <ConfirmActionForm action={removeLogoAction} fields={{ startupId }} trigger="Remove logo" title="Remove logo?"
              description="Your startup will show its initial instead until you choose another image." confirmLabel="Remove logo" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
