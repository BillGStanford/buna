"use client";

import * as React from "react";
import { useActionState } from "react";
import { saveCategoryAction } from "@/app/admin/actions";
import { CheckboxField, TextField } from "@/components/ui/fields";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/types";

type Cat = { id: string; slug: string; name: string; description: string | null; sort_order: number; is_active: boolean };

export function CategoryForm({ category }: { category?: Cat }) {
  const [state, action] = useActionState(saveCategoryAction, idleState);
  const { toast } = useToast();
  React.useEffect(() => { if (state.status === "success" && state.message) toast(state.message); }, [state, toast]);
  const err = state.status === "error";
  const pick = (k: string, fb: string) => (err ? valueOf(state, k, fb) : fb);
  const id = category?.id ?? "new";
  return (
    <form key={state.status === "success" && !category ? state.message : "f"} action={action} className="space-y-3" noValidate>
      <input type="hidden" name="categoryId" value={category?.id ?? ""} />
      {state.status === "error" && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <TextField id={`c-name-${id}`} label="Name" name="name" required defaultValue={category?.name ?? ""} error={firstError(state, "name")} />
        <TextField id={`c-slug-${id}`} label="Slug" name="slug" required defaultValue={category?.slug ?? ""} error={firstError(state, "slug")} />
        <TextField id={`c-order-${id}`} label="Order" name="sortOrder" inputMode="numeric" defaultValue={String(category?.sort_order ?? 100)} error={firstError(state, "sortOrder")} />
        <div className="flex items-end"><CheckboxField id={`c-active-${id}`} name="isActive" label="Active" defaultChecked={category?.is_active ?? true} /></div>
      </div>
      <TextField id={`c-desc-${id}`} label="Description (optional)" name="description" defaultValue={pick("description", category?.description ?? "")} error={firstError(state, "description")} />
      <SubmitButton size="sm" variant={category ? "secondary" : "primary"} pendingLabel="Saving…">{category ? "Save" : "Create category"}</SubmitButton>
    </form>
  );
}
