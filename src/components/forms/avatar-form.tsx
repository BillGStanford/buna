"use client";

import { useActionState } from "react";
import { removeAvatarAction, uploadAvatarAction } from "@/app/dashboard/profile/actions";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function AvatarForm({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [state, action] = useActionState(uploadAvatarAction, idleState);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar name={name} src={avatarUrl} size={72} />
      <div className="space-y-3">
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="avatar-file" className="sr-only">Choose a profile photo</label>
          <input id="avatar-file" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required
            className="block w-full max-w-xs text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-primary-mint" />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Uploading…">Upload photo</SubmitButton>
        </form>
        <p className="text-xs text-muted">JPEG, PNG or WebP, up to 2 MB.</p>
        <FormMessage state={state} />
        {avatarUrl ? (
          <form action={removeAvatarAction}>
            <SubmitButton size="sm" variant="ghost">Remove photo</SubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
