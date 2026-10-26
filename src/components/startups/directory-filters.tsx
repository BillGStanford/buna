import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/fields";
import { AFRICAN_COUNTRIES } from "@/lib/geo";
import { STAGES } from "@/lib/startups/constants";
import { hasActiveFilters, type DirectoryParams } from "@/lib/startups/params";
import type { CategoryOption } from "@/lib/startups/queries";

/** Plain GET form: works without JavaScript and keeps every filter in the URL (shareable, back-button safe). */
export function DirectoryFilters({ params, categories }: { params: DirectoryParams; categories: CategoryOption[] }) {
  return (
    <form action="/startups" method="get" role="search" aria-label="Search startups" className="space-y-4 rounded-lg border border-line bg-primary-pale p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="Search" name="q" type="search" placeholder="Name or what they build" defaultValue={params.q} maxLength={80} />
        </div>
        <Button type="submit" className="sm:w-36"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField label="Sector" name="category" defaultValue={params.category}>
          <option value="">All sectors</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </SelectField>
        <SelectField label="Country" name="country" defaultValue={params.country}>
          <option value="">All countries</option>
          {AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </SelectField>
        <TextField label="City" name="city" defaultValue={params.city} maxLength={60} />
        <SelectField label="Stage" name="stage" defaultValue={params.stage}>
          <option value="">Any stage</option>
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </SelectField>
        <SelectField label="Sort by" name="sort" defaultValue={params.sort}>
          <option value="newest">Recently added</option>
          <option value="featured">Featured first</option>
          <option value="name">Name (A–Z)</option>
        </SelectField>
      </div>
      {hasActiveFilters(params) ? <Link href="/startups" className="inline-block text-sm font-medium">Clear all filters</Link> : null}
    </form>
  );
}
