import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/fields";
import { EmptyState } from "@/components/illustrations";
import { InvestorCard } from "@/components/people/cards";
import { Pagination } from "@/components/startups/pagination";
import { AFRICAN_COUNTRIES } from "@/lib/geo";
import { isSupabaseConfigured } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { buildInvestorHref, hasActiveInvestorFilters, INVESTOR_PAGE_SIZE, parseInvestorParams } from "@/lib/people/params";
import { listInvestors, type InvestorData } from "@/lib/people/queries";
import { STAGES } from "@/lib/startups/constants";
import { listCategories, type CategoryOption } from "@/lib/startups/queries";

const log = createLogger("investors");
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const p = parseInvestorParams(await searchParams);
  return { title: "Investors", description: "Investors and investment organisations backing African startups — with what they publicly say they look for.", alternates: { canonical: "/investors" }, robots: hasActiveInvestorFilters(p) || p.page > 1 ? { index: false, follow: true } : undefined };
}

export default async function InvestorsPage({ searchParams }: { searchParams: SP }) {
  const params = parseInvestorParams(await searchParams);
  let items: InvestorData[] = [];
  let total = 0;
  let categories: CategoryOption[] = [];
  let failed = false;
  try { [categories, { items, total }] = await Promise.all([listCategories(), listInvestors(params)]); } catch (err) { log.error("investor list failed", err); failed = true; }
  const pages = Math.max(1, Math.ceil(total / INVESTOR_PAGE_SIZE));
  if (!failed && total > 0 && params.page > pages) redirect(buildInvestorHref({ page: pages }, params));

  return (
    <div className="container-page space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Investors</h1>
        <p className="mt-2 max-w-2xl text-muted">Information is publicly stated by each organisation. Being listed on Buna is not an endorsement of — or by — any investor or startup, and Buna doesn’t broker investments.</p>
      </div>
      <form action="/investors" method="get" role="search" aria-label="Search investors" className="space-y-3 rounded-lg border border-line bg-primary-pale p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><TextField label="Search" name="q" type="search" placeholder="Organisation or focus" defaultValue={params.q} maxLength={80} /></div>
          <Button type="submit" className="sm:w-36"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Stage" name="stage" defaultValue={params.stage}><option value="">Any stage</option>{STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</SelectField>
          <SelectField label="Sector" name="sector" defaultValue={params.sector}><option value="">Any sector</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</SelectField>
          <SelectField label="Country" name="country" defaultValue={params.country}><option value="">Any country</option>{AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</SelectField>
        </div>
        {hasActiveInvestorFilters(params) ? <Link href="/investors" className="inline-block text-sm font-medium">Clear all filters</Link> : null}
      </form>
      {failed ? <Alert tone="error" title="We couldn’t load investors">Something went wrong on our side. <Link href={buildInvestorHref({}, params)} className="font-medium">Try again</Link>.</Alert>
        : !isSupabaseConfigured() ? <Alert tone="warning" title="Not connected yet">This site isn’t connected to its database, so there’s nothing to show.</Alert>
        : items.length === 0 ? <EmptyState illustration={hasActiveInvestorFilters(params) ? "search" : "saved"} title={hasActiveInvestorFilters(params) ? "No investors match those filters" : "No investors are listed yet"} action={hasActiveInvestorFilters(params) ? <Link href="/investors" className={buttonStyles("secondary", "md")}>Clear all filters</Link> : <Link href="/contact" className={buttonStyles("primary", "md")}>Suggest an investor</Link>}>{hasActiveInvestorFilters(params) ? "Try a broader search or remove a filter." : "Listings are added after the Buna team reviews them."}</EmptyState>
        : (<><p className="text-sm text-muted" aria-live="polite"><span className="tabular-nums">{total}</span> {total === 1 ? "investor" : "investors"}</p><ul className="grid gap-3 lg:grid-cols-2">{items.map((i) => <InvestorCard key={i.id} i={i} />)}</ul><Pagination page={params.page} pages={pages} hrefFor={(n) => buildInvestorHref({ page: n }, params)} /></>)}
    </div>
  );
}
