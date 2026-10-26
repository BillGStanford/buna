"use client";

import { useActionState } from "react";
import { saveOpportunityAction } from "@/app/admin/opportunities/actions";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { AFRICAN_COUNTRIES } from "@/lib/geo";
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_STATUSES } from "@/lib/opportunities/constants";
import { idleState } from "@/lib/types";
import type { OpportunityDetail } from "@/lib/opportunities/queries";

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export function OpportunityForm({ opportunity }: { opportunity?: OpportunityDetail }) {
  const [state, action] = useActionState(saveOpportunityAction, idleState);
  const err = state.status === "error";
  const pick = (k: string, fallback: string) => (err ? valueOf(state, k, fallback) : fallback);
  const selectedCountries = err && Array.isArray(state.values?.countries) ? (state.values.countries as string[]) : (opportunity?.countries ?? []);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="opportunityId" value={opportunity?.id ?? ""} />
      <FormMessage state={state} />
      <TextField label="Title" name="title" required maxLength={140} defaultValue={pick("title", opportunity?.title ?? "")} error={firstError(state, "title")} />
      <TextField label="Organisation" name="organization" required maxLength={120} defaultValue={pick("organization", opportunity?.organization ?? "")} error={firstError(state, "organization")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Category" name="category" required defaultValue={pick("category", opportunity?.category ?? "")} error={firstError(state, "category")}><option value="" disabled>Choose a category</option>{OPPORTUNITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</SelectField>
        <SelectField label="Status" name="status" defaultValue={pick("status", opportunity?.status ?? "draft")} error={firstError(state, "status")}>{OPPORTUNITY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</SelectField>
      </div>
      <TextAreaField label="Description" name="description" rows={6} maxLength={5000} defaultValue={pick("description", opportunity?.description ?? "")} error={firstError(state, "description")} />
      <TextAreaField label="Eligibility" name="eligibility" rows={3} maxLength={2000} defaultValue={pick("eligibility", opportunity?.eligibility ?? "")} error={firstError(state, "eligibility")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Deadline (UTC)" name="deadline" type="datetime-local" hint="Leave empty for rolling opportunities." defaultValue={pick("deadline", toLocal(opportunity?.deadline ?? null))} error={firstError(state, "deadline")} />
        <TextField label="Published by the organiser on" name="publishedDate" type="date" defaultValue={pick("publishedDate", opportunity?.published_date ?? "")} error={firstError(state, "publishedDate")} />
        <TextField label="Application link" name="applicationUrl" type="url" placeholder="https://" defaultValue={pick("applicationUrl", opportunity?.application_url ?? "")} error={firstError(state, "applicationUrl")} />
        <TextField label="Source link" name="sourceUrl" type="url" placeholder="https://" hint="Required to publish: where the information came from." defaultValue={pick("sourceUrl", opportunity?.source_url ?? "")} error={firstError(state, "sourceUrl")} />
      </div>
      <SelectField label="Open to people in (leave empty for all of Africa)" name="countries" multiple size={8} defaultValue={selectedCountries} error={firstError(state, "countries")}>
        {AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </SelectField>
      <TextField label="Tags" name="tags" hint="Comma-separated, up to 8." defaultValue={pick("tags", opportunity?.tags.join(", ") ?? "")} error={firstError(state, "tags")} />
      <CheckboxField name="markChecked" label="I verified the details against the source today" hint="Updates the “last checked” date shown to visitors." />
      <SubmitButton pendingLabel="Saving…">{opportunity ? "Save changes" : "Create opportunity"}</SubmitButton>
    </form>
  );
}
