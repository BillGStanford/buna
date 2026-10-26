"use client";

import { useActionState } from "react";
import { addLaunchScreenshotAction, removeLaunchLogoAction, removeLaunchScreenshotAction, uploadLaunchLogoAction } from "@/app/dashboard/launches/actions";
import { StartupLogo } from "@/components/startups/startup-logo";
import { TextField } from "@/components/ui/fields";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { LAUNCH_LIMITS } from "@/lib/launches/constants";
import { idleState } from "@/lib/types";

const fileClass = "block w-full max-w-xs text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-primary-mint";

export function LaunchLogoForm({ launchId, name, logoUrl }: { launchId: string; name: string; logoUrl: string | null }) {
  const [state, action] = useActionState(uploadLaunchLogoAction, idleState);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <StartupLogo name={name} src={logoUrl} size={80} />
      <div className="space-y-3">
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="launchId" value={launchId} />
          <label htmlFor="launch-logo-file" className="sr-only">Choose a logo or product image</label>
          <input id="launch-logo-file" name="logo" type="file" accept="image/jpeg,image/png,image/webp" required className={fileClass} />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Uploading…">Upload image</SubmitButton>
        </form>
        <p className="text-xs text-muted">Square works best. JPEG, PNG or WebP, up to 2 MB.</p>
        <FormMessage state={state} />
        {logoUrl ? <ConfirmActionForm action={removeLaunchLogoAction} fields={{ launchId }} trigger="Remove image" title="Remove the product image?" description="The card will show your startup’s logo or an initial instead." confirmLabel="Remove image" /> : null}
      </div>
    </div>
  );
}

type Media = { id: string; url: string; alt_text: string | null };

export function LaunchScreenshots({ launchId, media }: { launchId: string; media: Media[] }) {
  const [state, action] = useActionState(addLaunchScreenshotAction, idleState);
  const full = media.length >= LAUNCH_LIMITS.screenshots;
  return (
    <div className="space-y-6">
      {media.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {media.map((m) => (
            <li key={m.id} className="space-y-2 rounded-lg border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt_text ?? ""} loading="lazy" decoding="async" className="aspect-video w-full rounded-md border border-line object-cover" />
              <p className="text-sm text-muted">{m.alt_text}</p>
              <ConfirmActionForm action={removeLaunchScreenshotAction} fields={{ launchId, mediaId: m.id }} trigger="Remove" title="Remove this screenshot?" description="It will disappear from your launch page." confirmLabel="Remove screenshot" />
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">No screenshots yet.</p>}
      {full ? <p className="text-sm text-muted">You’ve reached the limit of <span className="tabular-nums">{LAUNCH_LIMITS.screenshots}</span> screenshots.</p> : (
        <form action={action} className="space-y-4 rounded-lg border border-line bg-primary-pale p-4" noValidate>
          <input type="hidden" name="launchId" value={launchId} />
          <h3 className="font-semibold">Add a screenshot</h3>
          <FormMessage state={state} />
          <div>
            <label htmlFor="launch-shot-file" className="mb-1.5 block text-sm font-medium">Image</label>
            <input id="launch-shot-file" name="image" type="file" accept="image/jpeg,image/png,image/webp" required className={fileClass} />
            <p className="mt-1 text-xs text-muted">JPEG, PNG or WebP, up to 4 MB.</p>
          </div>
          <TextField label="Describe the image" name="altText" required maxLength={200} hint="Used by screen readers and when the image can’t load." error={firstError(state, "altText")} />
          <SubmitButton variant="secondary" pendingLabel="Uploading…">Add screenshot</SubmitButton>
        </form>
      )}
    </div>
  );
}
