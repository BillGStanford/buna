import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/fields";
import { EmptyState } from "@/components/illustrations";
import { FounderCard } from "@/components/people/cards";
import { Pagination } from "@/components/startups/pagination";
import { AFRICAN_COUNTRIES } from "@/lib/geo";
import { createLogger } from "@/lib/logger";
import { isSupabaseConfigured } from "@/lib/env";
import { buildFounderHref, FOUNDER_PAGE_SIZE, hasActiveFounderFilters, OPEN_TO, parseFounderParams } from "@/lib/people/params";
import { listFounders, type FounderCard as Founder } from "@/lib/people/queries";
import { listCategories, type CategoryOption } from "@/lib/startups/queries";

const log = createLogger("founders");
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const p = parseFounderParams(await searchParams);
  return { title: "Founders", description: "Meet African founders who’ve chosen to be listed — by sector, expertise, location and what they’re open to.", alternates: { canonical: "/founders" }, robots: hasActiveFounderFilters(p) || p.page > 1 ? { index: false, follow: true } : undefined };
}

export default async function FoundersPage({ searchParams }: { searchParams: SP }) {
  const params = parseFounderParams(await searchParams);
  let items: Founder[] = [];
  let total = 0;
  let categories: CategoryOption[] = [];
  let failed = false;
  try { [categories, { items, total }] = await Promise.all([listCategories(), listFounders(params)]); } catch (err) { log.error("founder list failed", err); failed = true; }
  const pages = Math.max(1, Math.ceil(total / FOUNDER_PAGE_SIZE));
  if (!failed && total > 0 && params.page > pages) redirect(buildFounderHref({ page: pages }, params));

  return (
    <div className="container-page space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Founders</h1>
        <p className="mt-2 max-w-2xl text-muted">People who’ve chosen to be listed. Only what they’ve decided to share is shown — never contact details.</p>
      </div>
      <form action="/founders" method="get" role="search" aria-label="Search founders" className="space-y-3 rounded-lg border border-line bg-primary-pale p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><TextField label="Search" name="q" type="search" placeholder="Name, headline or bio" defaultValue={params.q} maxLength={80} /></div>
          <Button type="submit" className="sm:w-36"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField label="Country" name="country" defaultValue={params.country}><option value="">Any country</option>{AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</SelectField>
          <TextField label="City" name="city" defaultValue={params.city} maxLength={60} />
          <SelectField label="Industry interest" name="interest" defaultValue={params.interest}><option value="">Any industry</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</SelectField>
          <TextField label="Expertise" name="expertise" placeholder="e.g. payments" defaultValue={params.expertise} maxLength={40} />
          <SelectField label="Open to" name="openTo" defaultValue={params.openTo}><option value="">Anything</option>{OPEN_TO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
        </div>
        {hasActiveFounderFilters(params) ? <Link href="/founders" className="inline-block text-sm font-medium">Clear all filters</Link> : null}
      </form>
      {failed ? (
        <Alert tone="error" title="We couldn’t load founders">Something went wrong on our side. <Link href={buildFounderHref({}, params)} className="font-medium">Try again</Link>.</Alert>
      ) : !isSupabaseConfigured() ? (
        <Alert tone="warning" title="Not connected yet">This site isn’t connected to its database, so there’s nothing to show.</Alert>
      ) : items.length === 0 ? (
        <EmptyState illustration={hasActiveFounderFilters(params) ? "search" : "team"} title={hasActiveFounderFilters(params) ? "No founders match those filters" : "No founders are listed yet"}
          action={hasActiveFounderFilters(params) ? <Link href="/founders" className={buttonStyles("secondary", "md")}>Clear all filters</Link> : <Link href="/dashboard/profile" className={buttonStyles("primary", "md")}>List yourself</Link>}>
          {hasActiveFounderFilters(params) ? "Try a broader search or remove a filter." : "Turn on “List me in the founder directory” in your profile to appear here."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite"><span className="tabular-nums">{total}</span> {total === 1 ? "founder" : "founders"}</p>
          <ul className="grid gap-3 lg:grid-cols-2">{items.map((f) => <FounderCard key={f.id} f={f} />)}</ul>
          <Pagination page={params.page} pages={pages} hrefFor={(n) => buildFounderHref({ page: n }, params)} />
        </>
      )}
    </div>
  );
}
