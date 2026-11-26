"use client";

import * as React from "react";
import { useActionState } from "react";
import { savePlatformTagAction } from "@/app/admin/tags/actions";
import { CheckboxField, TextField } from "@/components/ui/fields";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState, type ActionState } from "@/lib/types";

type PlatformTag = { id: string; name: string; slug: string; description: string | null; is_active: boolean };

export function PlatformTagForm({ tag }: { tag?: PlatformTag }) {
  const [state, action] = useActionState(savePlatformTagAction, idleState);
  const { toast } = useToast();
  React.useEffect(() => { if (state.status === "success" && state.message) toast(state.message); }, [state, toast]);
  return (
    <form key={state.status === "success" ? state.message : "form"} action={action} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="tagId" value={tag?.id ?? ""} />
      {state.status === "error" ? <div className="sm:col-span-2"><FormMessage state={state} /></div> : null}
      <TextField id={`tag-name-${tag?.id ?? "new"}`} label="Tag name" name="name" required maxLength={48} defaultValue={tag?.name ?? ""} error={firstError(state, "name")} />
      <TextField id={`tag-slug-${tag?.id ?? "new"}`} label="Slug" name="slug" required maxLength={60} defaultValue={tag?.slug ?? ""} error={firstError(state, "slug")} />
      <div className="sm:col-span-2"><TextField id={`tag-description-${tag?.id ?? "new"}`} label="Description (optional)" name="description" maxLength={240} defaultValue={tag?.description ?? ""} error={firstError(state, "description")} /></div>
      <div className="sm:col-span-2"><CheckboxField id={`tag-active-${tag?.id ?? "new"}`} name="isActive" label="Active and available for use" defaultChecked={tag?.is_active ?? true} /></div>
      <div className="sm:col-span-2"><SubmitButton size="sm" variant={tag ? "secondary" : "primary"} pendingLabel="Saving…">{tag ? "Save tag" : "Create tag"}</SubmitButton></div>
    </form>
  );
}
