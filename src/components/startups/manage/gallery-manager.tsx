"use client";

import { useActionState } from "react";
import { addGalleryImageAction, removeGalleryImageAction } from "@/app/dashboard/startup/actions";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { LIMITS } from "@/lib/startups/constants";
import { idleState } from "@/lib/types";

type Media = { id: string; url: string; alt_text: string | null };

export function GalleryManager({ startupId, media }: { startupId: string; media: Media[] }) {
  const [state, action] = useActionState(addGalleryImageAction, idleState);
  const full = media.length >= LIMITS.gallery;
  return (
    <div className="space-y-6">
      {media.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {media.map((m) => (
            <li key={m.id} className="space-y-2 rounded-lg border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt_text ?? ""} loading="lazy" decoding="async" className="aspect-video w-full rounded-md border border-line object-cover" />
              <p className="text-sm text-muted">{m.alt_text}</p>
              <ConfirmActionForm action={removeGalleryImageAction} fields={{ startupId, mediaId: m.id }} trigger="Remove"
                title="Remove this screenshot?" description="It will disappear from your public profile." confirmLabel="Remove screenshot" />
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">No screenshots yet.</p>}

      {full ? (
        <p className="text-sm text-muted">You’ve reached the limit of <span className="tabular-nums">{LIMITS.gallery}</span> screenshots.</p>
      ) : (
        <form action={action} className="space-y-4 rounded-lg border border-line bg-primary-pale p-4" noValidate>
          <input type="hidden" name="startupId" value={startupId} />
          <h3 className="font-semibold">Add a screenshot</h3>
          <FormMessage state={state} />
          <div>
            <label htmlFor="gallery-file" className="mb-1.5 block text-sm font-medium">Image</label>
            <input id="gallery-file" name="image" type="file" accept="image/jpeg,image/png,image/webp" required
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-primary-mint" />
            <p className="mt-1 text-xs text-muted">JPEG, PNG or WebP, up to 4 MB. 16:9 looks best.</p>
          </div>
          <TextField label="Describe the image" name="altText" required maxLength={200} hint="Used by screen readers and when the image can’t load."
            error={firstError(state, "altText")} />
          <SubmitButton variant="secondary" pendingLabel="Uploading…">Add screenshot</SubmitButton>
        </form>
      )}
    </div>
  );
}
