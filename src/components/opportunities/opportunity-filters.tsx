import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/fields";
import { cn } from "@/lib/utils";
import { AFRICAN_COUNTRIES } from "@/lib/geo";
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_WHEN } from "@/lib/opportunities/constants";
import { buildOpportunityHref, hasActiveOpportunityFilters, type OpportunityParams } from "@/lib/opportunities/params";

export function OpportunityFilters({ params }: { params: OpportunityParams }) {
  return (
    <div className="space-y-4">
      <nav aria-label="Opportunity status" className="flex gap-1 overflow-x-auto border-b border-line">
        {OPPORTUNITY_WHEN.map((w) => (
          <Link key={w.value} href={buildOpportunityHref({ when: w.value, page: 1 }, params)} aria-current={params.when === w.value ? "page" : undefined}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium no-underline", params.when === w.value ? "border-primary text-primary-deep" : "border-transparent text-muted hover:text-ink")}>
            {w.label}
          </Link>
        ))}
      </nav>
      <form action="/opportunities" method="get" role="search" aria-label="Search opportunities" className="space-y-3 rounded-lg border border-line bg-primary-pale p-4">
        <input type="hidden" name="when" value={params.when} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><TextField label="Search" name="q" type="search" placeholder="Programme, organisation or topic" defaultValue={params.q} maxLength={80} /></div>
          <Button type="submit" className="sm:w-36"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Type" name="category" defaultValue={params.category}><option value="">All types</option>{OPPORTUNITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</SelectField>
          <SelectField label="Open to people in" name="country" defaultValue={params.country}><option value="">Any country</option>{AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</SelectField>
          <SelectField label="Sort by" name="sort" defaultValue={params.sort}><option value="deadline">Deadline (soonest)</option><option value="newest">Newest</option></SelectField>
        </div>
        {hasActiveOpportunityFilters(params) ? <Link href="/opportunities" className="inline-block text-sm font-medium">Clear all filters</Link> : null}
      </form>
    </div>
  );
}
