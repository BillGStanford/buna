import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { OpportunityFilters } from "@/components/opportunities/opportunity-filters";
import { OpportunityList } from "@/components/opportunities/opportunity-card";
import { EmptyState } from "@/components/illustrations";
import { Pagination } from "@/components/startups/pagination";
import { buttonStyles } from "@/components/ui/button";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { OPPORTUNITY_PAGE_SIZE, OPPORTUNITY_WHEN } from "@/lib/opportunities/constants";
import { buildOpportunityHref, hasActiveOpportunityFilters, parseOpportunityParams } from "@/lib/opportunities/params";
import { listOpportunities, type OpportunityCardData } from "@/lib/opportunities/queries";

const log = createLogger("opportunities");
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const p = parseOpportunityParams(await searchParams);
  return {
    title: "Opportunities",
    description: "Discover grants, accelerators, competitions, fellowships, jobs and events for African founders.",
    alternates: { canonical: "/opportunities" },
    robots: hasActiveOpportunityFilters(p) || p.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: SP }) {
  const params = parseOpportunityParams(await searchParams);
  const user = await getUser();
  let items: OpportunityCardData[] = [];
  let total = 0;
  let failed = false;
  try { ({ items, total } = await listOpportunities(params, user?.id ?? null)); } catch (err) { log.error("opportunity list failed", err); failed = true; }
  const pages = Math.max(1, Math.ceil(total / OPPORTUNITY_PAGE_SIZE));
  if (!failed && total > 0 && params.page > pages) redirect(buildOpportunityHref({ page: pages }, params));
  const returnTo = buildOpportunityHref({}, params);

  return (
    <div className="container-page space-y-6 py-8 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-deep">Buna ecosystem</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Discover opportunities</h1>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-base">Find grants, accelerators, competitions and programmes that help African founders move forward.</p>
        </div>
        <div className="rounded-full border border-primary/20 bg-primary-pale px-4 py-2 text-sm font-semibold text-primary-deep">
          <span className="tabular-nums">{total}</span> {total === 1 ? "opportunity" : "opportunities"}
        </div>
      </header>

      <section aria-label="Opportunity search" className="rounded-xl border border-line bg-surface p-3 shadow-[0_1px_3px_rgba(23,43,36,0.04)] sm:p-4">
        <form action="/opportunities" method="get" role="search" className="flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="when" value={params.when} />
          <input type="hidden" name="category" value={params.category} />
          <input type="hidden" name="country" value={params.country} />
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg border border-line bg-primary-pale px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input type="search" name="q" defaultValue={params.q} maxLength={80} placeholder="Search grants, programmes, organisations..." aria-label="Search opportunities" className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted/80 focus:ring-0" />
          </label>
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-line bg-primary-pale px-3 text-sm">
            <span className="text-muted">Sort</span>
            <select name="sort" defaultValue={params.sort} className="min-w-32 bg-transparent font-medium text-ink outline-none">
              <option value="deadline">Best match</option>
              <option value="newest">Recently added</option>
            </select>
          </label>
          <button type="submit" className={buttonStyles("primary", "md")}>Search opportunities</button>
        </form>
        <nav aria-label="Opportunity deadline" className="mt-4 flex gap-2 overflow-x-auto border-t border-line pt-3">
          {OPPORTUNITY_WHEN.map((w) => (
            <Link key={w.value} href={buildOpportunityHref({ when: w.value, page: 1 }, params)} aria-current={params.when === w.value ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold no-underline transition-colors ${params.when === w.value ? "bg-primary-pale text-primary-deep" : "text-muted hover:bg-primary-pale hover:text-ink"}`}>
              {w.label}
            </Link>
          ))}
        </nav>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5">
          <OpportunityFilters params={params} />
        </aside>
        <section aria-label="Opportunity results" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Available opportunities</h2>
              <p className="text-sm text-muted">{failed ? "Unable to load results" : `Showing ${items.length} of ${total} listings`}</p>
            </div>
            {params.page > 1 ? <p className="text-xs text-muted">Page <span className="tabular-nums">{params.page}</span> of <span className="tabular-nums">{pages}</span></p> : null}
          </div>
          {failed ? (
            <Alert tone="error" title="We couldn’t load opportunities">Something went wrong on our side. <Link href={returnTo} className="font-medium">Try again</Link>.</Alert>
          ) : !isSupabaseConfigured() ? (
            <Alert tone="warning" title="Not connected yet">This site isn’t connected to its database, so there’s nothing to show.</Alert>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface px-5 py-12 text-center">
              <EmptyState illustration={hasActiveOpportunityFilters(params) ? "search" : "opportunities"} title={hasActiveOpportunityFilters(params) ? "No opportunities match those filters" : params.when === "closed" ? "No closed opportunities" : "No open opportunities right now"}
                action={hasActiveOpportunityFilters(params) ? <Link href="/opportunities" className={buttonStyles("secondary", "md")}>Clear all filters</Link> : undefined}>
                {hasActiveOpportunityFilters(params) ? "Try a broader search or remove a filter." : "Check back soon — new programmes are added as we verify them."}
              </EmptyState>
            </div>
          ) : (
            <>
              <OpportunityList items={items} signedIn={Boolean(user)} returnTo={returnTo} />
              <Pagination page={params.page} pages={pages} hrefFor={(n) => buildOpportunityHref({ page: n }, params)} />
            </>
          )}
        </section>
      </div>
      <p className="text-xs leading-5 text-muted">Opportunity details can change. Always confirm eligibility, deadlines and application requirements with the original organiser before applying.</p>
    </div>
  );
}
