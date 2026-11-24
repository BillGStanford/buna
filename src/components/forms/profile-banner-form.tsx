"use client";

import { useActionState } from "react";
import { removeProfileBannerAction, uploadProfileBannerAction } from "@/app/dashboard/profile/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function ProfileBannerForm({ bannerUrl }: { bannerUrl: string | null }) {
  const [state, action] = useActionState(uploadProfileBannerAction, idleState);
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Profile banner</h2>
        <p className="mt-1 text-sm text-muted">Give your profile a recognizable visual identity. A wide image works best.</p>
      </div>
      <div className="h-28 overflow-hidden rounded-lg border border-line bg-primary-pale sm:h-36">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="Current profile banner" className="h-full w-full object-cover" />
        ) : <div className="flex h-full items-center justify-center text-sm text-muted">No banner uploaded</div>}
      </div>
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="profile-banner-file">Choose a profile banner</label>
        <input id="profile-banner-file" name="banner" type="file" accept="image/jpeg,image/png,image/webp" required
          className="block w-full max-w-sm text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink" />
        <SubmitButton size="sm" variant="secondary" pendingLabel="Uploading…">Upload banner</SubmitButton>
      </form>
      <p className="text-xs text-muted">JPEG, PNG or WebP, up to 5 MB. Your banner appears only when your profile is public.</p>
      <FormMessage state={state} />
      {bannerUrl ? <form action={removeProfileBannerAction}><SubmitButton size="sm" variant="ghost">Remove banner</SubmitButton></form> : null}
    </section>
  );
}
