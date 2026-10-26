import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/fields";
import { cn } from "@/lib/utils";
import { LAUNCH_PERIODS, LAUNCH_SORTS } from "@/lib/launches/constants";
import { buildLaunchHref, hasActiveLaunchFilters, type LaunchParams } from "@/lib/launches/params";
import type { CategoryOption } from "@/lib/startups/queries";

export function LaunchFilters({ params, categories }: { params: LaunchParams; categories: CategoryOption[] }) {
  return (
    <div className="space-y-4">
      <nav aria-label="Launch lists" className="flex gap-1 overflow-x-auto border-b border-line">
        {LAUNCH_SORTS.map((s) => (
          <Link key={s.value} href={buildLaunchHref({ sort: s.value, page: 1 }, params)} title={s.hint} aria-current={params.sort === s.value ? "page" : undefined}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium no-underline",
              params.sort === s.value ? "border-primary text-primary-deep" : "border-transparent text-muted hover:text-ink")}>
            {s.label}
          </Link>
        ))}
      </nav>
      <form action="/launches" method="get" role="search" aria-label="Search launches" className="space-y-3 rounded-lg border border-line bg-primary-pale p-4">
        <input type="hidden" name="sort" value={params.sort} />
        {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><TextField label="Search" name="q" type="search" placeholder="Product name or what it does" defaultValue={params.q} maxLength={80} /></div>
          <Button type="submit" className="sm:w-36"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Sector" name="category" defaultValue={params.category}>
            <option value="">All sectors</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Launched" name="period" defaultValue={params.period}>
            {LAUNCH_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </SelectField>
        </div>
        {params.tag || hasActiveLaunchFilters(params) ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {params.tag ? (
              <Link href={buildLaunchHref({ tag: "", page: 1 }, params)} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-ink no-underline hover:bg-primary-mint">
                #{params.tag}<X className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">Remove tag filter</span>
              </Link>
            ) : null}
            <Link href={buildLaunchHref({ q: "", category: "", tag: "", period: "all", page: 1 }, params)} className="font-medium">Clear all filters</Link>
          </div>
        ) : null}
      </form>
    </div>
  );
}
