import Link from "next/link";
import { Globe2, SlidersHorizontal } from "lucide-react";
import { SelectField } from "@/components/ui/fields";
import { CountryPicker } from "@/components/ui/country-picker";

import { OPPORTUNITY_CATEGORIES } from "@/lib/opportunities/constants";
import { buildOpportunityHref, hasActiveOpportunityFilters, type OpportunityParams } from "@/lib/opportunities/params";

export function OpportunityFilters({ params }: { params: OpportunityParams }) {
  return (
    <form action="/opportunities" method="get" aria-label="Filter opportunities" className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_3px_rgba(23,43,36,0.04)]">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />Filters</h2>
        {hasActiveOpportunityFilters(params) ? <Link href="/opportunities" className="text-xs font-semibold text-primary-deep hover:underline">Reset</Link> : null}
      </div>
      <input type="hidden" name="q" value={params.q} />
      <input type="hidden" name="sort" value={params.sort} />
      <input type="hidden" name="when" value={params.when} />

      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Opportunity type</legend>
          <SelectField label="Category" name="category" defaultValue={params.category}>
            <option value="">All categories</option>
            {OPPORTUNITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </SelectField>
        </fieldset>
        <div className="border-t border-line" />
        <fieldset className="space-y-2">
          <legend className="mb-2 flex items-center gap-2 text-sm font-semibold"><Globe2 className="h-4 w-4 text-muted" aria-hidden="true" />Eligible country</legend>
          <CountryPicker label="Eligible country" name="country" defaultValue={params.country} placeholder="All eligible countries" />
          <p className="text-xs leading-5 text-muted">Choose the country where the founder or business is based.</p>
        </fieldset>
        <button type="submit" className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Apply filters</button>
      </div>
    </form>
  );
}
