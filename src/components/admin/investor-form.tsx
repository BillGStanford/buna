"use client";

import { useActionState } from "react";
import { saveInvestorAction } from "@/app/admin/investors/actions";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { AFRICAN_COUNTRIES } from "@/lib/geo";
import { STAGES } from "@/lib/startups/constants";
import { idleState } from "@/lib/types";
import type { InvestorData } from "@/lib/people/queries";
import type { CategoryOption } from "@/lib/startups/queries";

export function InvestorForm({ investor, categories, canVerify }: { investor?: InvestorData; categories: CategoryOption[]; canVerify: boolean }) {
  const [state, action] = useActionState(saveInvestorAction, idleState);
  const err = state.status === "error";
  const pick = (k: string, fallback: string) => (err ? valueOf(state, k, fallback) : fallback);
  const stages = err && Array.isArray(state.values?.stages) ? (state.values.stages as string[]) : (investor?.stages ?? []);
  const sectors = err && Array.isArray(state.values?.sectors) ? (state.values.sectors as string[]) : (investor?.sectors ?? []);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="investorId" value={investor?.id ?? ""} />
      <FormMessage state={state} />
      <TextField label="Organisation name" name="name" required maxLength={120} defaultValue={pick("name", investor?.name ?? "")} error={firstError(state, "name")} />
      <TextAreaField label="Public description" name="description" rows={4} maxLength={3000} defaultValue={pick("description", investor?.description ?? "")} error={firstError(state, "description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Website" name="websiteUrl" type="url" placeholder="https://" defaultValue={pick("websiteUrl", investor?.website_url ?? "")} error={firstError(state, "websiteUrl")} />
        <TextField label="Public application or contact link" name="contactUrl" type="url" placeholder="https://" defaultValue={pick("contactUrl", investor?.contact_url ?? "")} error={firstError(state, "contactUrl")} />
        <SelectField label="Country" name="country" defaultValue={pick("country", investor?.country ?? "")} error={firstError(state, "country")}><option value="">Not specified</option>{AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</SelectField>
        <TextField label="Regions" name="regions" hint="Comma-separated, e.g. East Africa, West Africa." defaultValue={pick("regions", investor?.regions.join(", ") ?? "")} error={firstError(state, "regions")} />
      </div>
      <fieldset><legend className="text-sm font-medium">Stages they say they invest in</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{STAGES.map((s) => <CheckboxField key={s.value} id={`stage-${s.value}`} name="stages" value={s.value} label={s.label} defaultChecked={stages.includes(s.value)} />)}</div></fieldset>
      <fieldset><legend className="text-sm font-medium">Sectors of interest</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{categories.map((c) => <CheckboxField key={c.slug} id={`sector-${c.slug}`} name="sectors" value={c.slug} label={c.name} defaultChecked={sectors.includes(c.slug)} />)}</div></fieldset>
      <TextAreaField label="Publicly stated investment thesis" name="thesis" rows={4} maxLength={3000} hint="Only what the organisation has said publicly. No invented fund sizes or portfolios." defaultValue={pick("thesis", investor?.thesis ?? "")} error={firstError(state, "thesis")} />
      <SelectField label="Verification" name="verificationStatus" disabled={!canVerify} defaultValue={pick("verificationStatus", investor?.verification_status ?? "unverified")} hint={canVerify ? "Verify only after checking the organisation yourself." : "Only admins can change verification."} error={firstError(state, "verificationStatus")}>
        {["unverified", "pending", "verified", "rejected", "revoked"].map((v) => <option key={v} value={v}>{v}</option>)}
      </SelectField>
      {!canVerify ? <input type="hidden" name="verificationStatus" value={investor?.verification_status ?? "unverified"} /> : null}
      <CheckboxField name="isPublished" label="Publish this listing" defaultChecked={investor?.is_published ?? false} />
      <SubmitButton pendingLabel="Saving…">{investor ? "Save changes" : "Create listing"}</SubmitButton>
    </form>
  );
}
