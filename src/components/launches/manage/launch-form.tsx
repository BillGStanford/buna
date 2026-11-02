"use client";

import { useActionState } from "react";
import { createLaunchAction, updateLaunchAction } from "@/app/dashboard/launches/actions";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { WebsiteUrlField } from "@/components/websites/website-url-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";
import type { CategoryOption } from "@/lib/startups/queries";
import type { ManagedLaunch } from "@/lib/launches/queries";

export function LaunchForm({ mode, launch, startups, categories }: {
  mode: "create" | "edit"; launch?: ManagedLaunch; startups: { id: string; name: string }[]; categories: CategoryOption[];
}) {
  const [state, action] = useActionState(mode === "create" ? createLaunchAction : updateLaunchAction, idleState);
  const err = state.status === "error";
  const pick = (k: string, fallback: string) => (err ? valueOf(state, k, fallback) : fallback);
  return (
    <form action={action} className="space-y-4" noValidate>
      {launch ? <input type="hidden" name="launchId" value={launch.id} /> : null}
      <FormMessage state={state} />
      <TextField label="Product name" name="name" required maxLength={80} defaultValue={pick("name", launch?.name ?? "")} error={firstError(state, "name")} />
      <TextField label="Short pitch" name="tagline" required maxLength={160} hint="One sentence on what it does and who it’s for (shown on cards)."
        defaultValue={pick("tagline", launch?.tagline ?? "")} error={firstError(state, "tagline")} />
      <TextField label="Product link" name="productUrl" type="url" inputMode="url" required placeholder="https://"
        hint="Where people can try it. Only https:// or http:// links are accepted." defaultValue={pick("productUrl", launch?.product_url ?? "")} error={firstError(state, "productUrl")} />
      <TextAreaField label="Description" name="description" rows={7} maxLength={5000}
        hint="Required before you can submit for review. What problem does it solve? Leave a blank line between paragraphs."
        defaultValue={pick("description", launch?.description ?? "")} error={firstError(state, "description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Sector" name="categoryId" defaultValue={pick("categoryId", launch?.category_id ?? "")} error={firstError(state, "categoryId")}>
          <option value="">Choose a sector</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <SelectField label="Startup (optional)" name="startupId" defaultValue={pick("startupId", launch?.startup_id ?? "")} error={firstError(state, "startupId")}
          hint={startups.length === 0 ? "Create a startup profile to link launches to it." : undefined}>
          <option value="">Not linked to a startup</option>
          {startups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <TextField label="Launch date (optional)" name="launchDate" type="date" hint="Leave empty to launch as soon as it’s approved. A future date schedules it."
          defaultValue={pick("launchDate", launch?.launch_date ?? "")} error={firstError(state, "launchDate")} />
        <TextField label="Tags" name="tags" hint="Comma-separated, up to 5. For example: payments, mobile."
          defaultValue={pick("tags", launch?.tags.join(", ") ?? "")} error={firstError(state, "tags")} />
      </div>
      <TextField label="Demo video (optional)" name="demoVideoUrl" type="url" inputMode="url" placeholder="https://"
        defaultValue={pick("demoVideoUrl", launch?.demo_video_url ?? "")} error={firstError(state, "demoVideoUrl")} />
      {mode === "create" ? (
        <div>
          <CheckboxField name="confirm" label="I’m allowed to submit this product and the information is accurate."
            hint="You’ll be shown as the maker. Launches are reviewed by the Buna team before they go live." />
          {firstError(state, "confirm") ? <p className="mt-1 text-xs font-medium text-danger">{firstError(state, "confirm")}</p> : null}
        </div>
      ) : null}
      <SubmitButton size={mode === "create" ? "lg" : "md"} pendingLabel="Saving…">{mode === "create" ? "Create launch draft" : "Save changes"}</SubmitButton>
    </form>
  );
}
