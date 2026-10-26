"use client";

import { useActionState } from "react";
import { updateStartupAction } from "@/app/dashboard/startup/actions";
import { TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { CategorySelect, StageSelect, StartupCountrySelect } from "./startup-fields";
import { idleState } from "@/lib/types";
import type { CategoryOption, ManagedStartup } from "@/lib/startups/queries";

export function StartupProfileForm({ startup, categories }: { startup: ManagedStartup["startup"]; categories: CategoryOption[] }) {
  const [state, action] = useActionState(updateStartupAction, idleState);
  const err = state.status === "error";
  const pick = (k: string, fallback: string) => (err ? valueOf(state, k, fallback) : fallback);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="startupId" value={startup.id} />
      <FormMessage state={state} />
      <TextField label="Startup name" name="name" required defaultValue={pick("name", startup.name)} error={firstError(state, "name")} />
      <TextField label="One-line description" name="tagline" maxLength={160} hint="Shown on cards and in search results (up to 160 characters)."
        defaultValue={pick("tagline", startup.tagline ?? "")} error={firstError(state, "tagline")} />
      <TextAreaField label="About" name="description" rows={7} maxLength={5000}
        hint="What you build, who it’s for and why it matters. Leave a blank line between paragraphs."
        defaultValue={pick("description", startup.description ?? "")} error={firstError(state, "description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CategorySelect categories={categories} defaultValue={pick("categoryId", startup.category_id ?? "")} error={firstError(state, "categoryId")} />
        <StageSelect defaultValue={pick("stage", startup.stage ?? "")} error={firstError(state, "stage")} />
        <StartupCountrySelect defaultValue={pick("country", startup.country ?? "")} error={firstError(state, "country")} />
        <TextField label="City" name="city" defaultValue={pick("city", startup.city ?? "")} error={firstError(state, "city")} />
        <TextField label="Founded in" name="foundedYear" inputMode="numeric" maxLength={4} placeholder="2024"
          defaultValue={pick("foundedYear", startup.founded_year ? String(startup.founded_year) : "")} error={firstError(state, "foundedYear")} />
        <TextField label="Website" name="websiteUrl" type="url" inputMode="url" placeholder="https://"
          defaultValue={pick("websiteUrl", startup.website_url ?? "")} error={firstError(state, "websiteUrl")} />
      </div>
      <TextField label="Tags" name="tags" hint="Comma-separated, up to 10. For example: payments, mobile money, SMEs."
        defaultValue={pick("tags", startup.tags.join(", "))} error={firstError(state, "tags")} />
      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
