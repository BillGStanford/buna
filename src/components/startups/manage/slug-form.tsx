"use client";

import { useActionState } from "react";
import { changeSlugAction } from "@/app/dashboard/startup/actions";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function SlugForm({ startupId, slug, canChange }: { startupId: string; slug: string; canChange: boolean }) {
  const [state, action] = useActionState(changeSlugAction, idleState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="startupId" value={startupId} />
      <FormMessage state={state} />
      <TextField label="Public address" name="slug" required disabled={!canChange} autoCapitalize="none" spellCheck={false}
        hint="Lowercase letters, numbers and dashes. Your old address keeps redirecting, so shared links don’t break."
        defaultValue={state.status === "idle" ? slug : valueOf(state, "slug", slug)} error={firstError(state, "slug")} />
      <p className="text-xs text-muted">Your profile lives at <strong>/startups/{slug}</strong></p>
      {canChange ? <SubmitButton variant="secondary" pendingLabel="Saving…">Change address</SubmitButton> : null}
    </form>
  );
}
