"use client";

import { useActionState } from "react";
import { updateStartupAction } from "@/app/dashboard/startup/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { WebsiteUrlField } from "@/components/websites/website-url-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { CategorySelect, StageSelect, StartupCountrySelect } from "./startup-fields";
import { idleState } from "@/lib/types";
import type { CategoryOption, ManagedStartup } from "@/lib/startups/queries";

const FUNDING_ROUNDS = [["pre_seed","Pre-seed"],["seed","Seed"],["series_a","Series A"],["series_b","Series B"],["series_c","Series C"],["growth","Growth"],["debt","Debt"],["grant","Grant"],["other","Other"]] as const;

export function StartupProfileForm({ startup, categories }: { startup: ManagedStartup["startup"]; categories: CategoryOption[] }) {
  const [state, action] = useActionState(updateStartupAction, idleState);
  const err = state.status === "error";
  const pick = (k: string, fallback: string) => (err ? valueOf(state, k, fallback) : fallback);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="startupId" value={startup.id} />
      <FormMessage state={state} />
      <div className="rounded-lg border border-line bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium">You can save this profile as a draft at any time.</p>
        <p className="text-muted">Saving does not publish your startup. Only the startup name is required to save. To publish later, complete these four fields: one-line description, About, sector and country, and confirm your email address.</p>
      </div>
      <section className="space-y-3">
        <h3 className="font-semibold">Company overview</h3>
        <TextField label="Startup name" name="name" required defaultValue={pick("name", startup.name)} error={firstError(state, "name")} />
        <TextField label="One-line description" name="tagline" maxLength={160} hint="Required before publishing. Shown on cards and in search results (up to 160 characters)."
          defaultValue={pick("tagline", startup.tagline ?? "")} error={firstError(state, "tagline")} />
        <TextAreaField label="About" name="description" rows={5} maxLength={5000}
          hint="Required before publishing. Explain what the company builds, who it serves and why it matters."
          defaultValue={pick("description", startup.description ?? "")} error={firstError(state, "description")} />
        <TextAreaField label="Problem" name="problemStatement" rows={4} maxLength={3000}
          hint="What specific, costly or urgent problem exists? Who experiences it?"
          defaultValue={pick("problemStatement", String(startup.problem_statement ?? ""))} error={firstError(state, "problemStatement")} />
        <TextAreaField label="Solution" name="solution" rows={4} maxLength={3000}
          hint="How does your product or service solve the problem? Explain what makes the approach useful."
          defaultValue={pick("solution", String(startup.solution ?? ""))} error={firstError(state, "solution")} />
      </section>
      <section className="space-y-3 border-t border-line pt-4">
        <h3 className="font-semibold">Target market</h3>
        <TextField label="Customer segments" name="targetCustomers" hint="Comma-separated, e.g. small retailers, banks, urban consumers."
          defaultValue={pick("targetCustomers", Array.isArray(startup.target_customers) ? startup.target_customers.join(", ") : "")} error={firstError(state, "targetCustomers")} />
        <TextField label="Target geographies" name="targetGeographies" hint="Comma-separated countries or regions, e.g. Ethiopia, East Africa, diaspora."
          defaultValue={pick("targetGeographies", Array.isArray(startup.target_geographies) ? startup.target_geographies.join(", ") : "")} error={firstError(state, "targetGeographies")} />
        <TextAreaField label="Market opportunity" name="marketOpportunity" rows={3} maxLength={3000}
          hint="Describe market size, demand, adoption trends or the opportunity. Include sources/assumptions where possible."
          defaultValue={pick("marketOpportunity", String(startup.market_opportunity ?? ""))} error={firstError(state, "marketOpportunity")} />
        <TextField label="Business model" name="businessModel" maxLength={80} placeholder="SaaS, marketplace commission, transaction fees, hardware + services"
          defaultValue={pick("businessModel", String(startup.business_model ?? ""))} error={firstError(state, "businessModel")} />
      </section>
      <section className="space-y-3 border-t border-line pt-4">
        <h3 className="font-semibold">Fundraising information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Funding round" name="fundingRound" defaultValue={pick("fundingRound", String(startup.funding_round ?? ""))} error={firstError(state, "fundingRound")}>
            <option value="">Not specified</option>{FUNDING_ROUNDS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </SelectField>
          <SelectField label="Fundraising status" name="fundraisingStatus" defaultValue={pick("fundraisingStatus", String(startup.fundraising_status ?? "not_raising"))} error={firstError(state, "fundraisingStatus")}>
            <option value="not_raising">Not currently raising</option><option value="raising">Actively raising</option><option value="open_to_conversations">Open to investor conversations</option><option value="closed">Fundraising closed</option>
          </SelectField>
          <TextField label="Target amount" name="fundingTarget" inputMode="decimal" placeholder="Optional"
            defaultValue={pick("fundingTarget", startup.funding_target == null ? "" : String(startup.funding_target))} error={firstError(state, "fundingTarget")} />
          <TextField label="Funding currency" name="fundingCurrency" maxLength={3}
            defaultValue={pick("fundingCurrency", String(startup.funding_currency ?? "USD"))} error={firstError(state, "fundingCurrency")} />
        </div>
      </section>
      <section className="space-y-3 border-t border-line pt-4">
        <h3 className="font-semibold">Company details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <CategorySelect categories={categories} defaultValue={pick("categoryId", startup.category_id ?? "")} error={firstError(state, "categoryId")} hint="Required before publishing." />
          <StageSelect defaultValue={pick("stage", startup.stage ?? "")} error={firstError(state, "stage")} />
          <StartupCountrySelect defaultValue={pick("country", startup.country ?? "")} error={firstError(state, "country")} hint="Required before publishing." />
          <TextField label="City" name="city" defaultValue={pick("city", startup.city ?? "")} error={firstError(state, "city")} />
          <TextField label="Founded in" name="foundedYear" inputMode="numeric" maxLength={4} placeholder="2024"
            defaultValue={pick("foundedYear", startup.founded_year ? String(startup.founded_year) : "")} error={firstError(state, "foundedYear")} />
          <WebsiteUrlField label="Website" name="websiteUrl" placeholder="https://"
            defaultValue={pick("websiteUrl", startup.website_url ?? "")} error={firstError(state, "websiteUrl")} />
        </div>
        <TextField label="Tags" name="tags" hint="Comma-separated, up to 10. For example: payments, mobile money, SMEs."
          defaultValue={pick("tags", startup.tags.join(", "))} error={firstError(state, "tags")} />
      </section>
      <SubmitButton pendingLabel="Saving…">{startup.status === "draft" ? "Save draft" : "Save changes"}</SubmitButton>
    </form>
  );
}
