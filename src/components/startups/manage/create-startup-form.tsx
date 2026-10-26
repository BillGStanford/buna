"use client";

import { useActionState } from "react";
import { createStartupAction } from "@/app/dashboard/startup/actions";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { CategorySelect, StartupCountrySelect } from "./startup-fields";
import { idleState } from "@/lib/types";
import type { CategoryOption } from "@/lib/startups/queries";

export function CreateStartupForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action] = useActionState(createStartupAction, idleState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField label="Startup name" name="name" required defaultValue={valueOf(state, "name")} error={firstError(state, "name")} />
      <TextField label="One-line description" name="tagline" maxLength={160} hint="What you do, in a sentence (you can finish this later)."
        defaultValue={valueOf(state, "tagline")} error={firstError(state, "tagline")} />
      <CategorySelect categories={categories} defaultValue={valueOf(state, "categoryId")} error={firstError(state, "categoryId")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StartupCountrySelect defaultValue={valueOf(state, "country")} error={firstError(state, "country")} />
        <TextField label="City" name="city" defaultValue={valueOf(state, "city")} error={firstError(state, "city")} />
      </div>
      <p className="text-sm text-muted">Your startup is created as a private draft. Nobody else sees it until you publish.</p>
      <SubmitButton size="lg" pendingLabel="Creating…">Create startup</SubmitButton>
    </form>
  );
}
