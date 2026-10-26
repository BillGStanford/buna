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
import { OPPORTUNITY_PAGE_SIZE } from "@/lib/opportunities/constants";
import { buildOpportunityHref, hasActiveOpportunityFilters, parseOpportunityParams } from "@/lib/opportunities/params";
import { listOpportunities, type OpportunityCardData } from "@/lib/opportunities/queries";

const log = createLogger("opportunities");
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const p = parseOpportunityParams(await searchParams);
  return {
    title: "Opportunities",
    description: "Grants, accelerators, competitions, fellowships, jobs and events for African founders — each with its source and deadline.",
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
    <div className="container-page space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Opportunities</h1>
        <p className="mt-2 max-w-2xl text-muted">Programmes and events for African founders. Every listing links to its original source — always confirm details with the organiser before applying.</p>
      </div>
      <OpportunityFilters params={params} />
      {failed ? (
        <Alert tone="error" title="We couldn’t load opportunities">Something went wrong on our side. <Link href={returnTo} className="font-medium">Try again</Link>.</Alert>
      ) : !isSupabaseConfigured() ? (
        <Alert tone="warning" title="Not connected yet">This site isn’t connected to its database, so there’s nothing to show.</Alert>
      ) : items.length === 0 ? (
        <EmptyState illustration={hasActiveOpportunityFilters(params) ? "search" : "opportunities"} title={hasActiveOpportunityFilters(params) ? "No opportunities match those filters" : params.when === "closed" ? "No closed opportunities" : "No open opportunities right now"}
          action={hasActiveOpportunityFilters(params) ? <Link href="/opportunities" className={buttonStyles("secondary", "md")}>Clear all filters</Link> : undefined}>
          {hasActiveOpportunityFilters(params) ? "Try a broader search or remove a filter." : "Check back soon — new programmes are added as we verify them."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite"><span className="tabular-nums">{total}</span> {total === 1 ? "opportunity" : "opportunities"}{params.page > 1 ? <> · page <span className="tabular-nums">{params.page}</span> of <span className="tabular-nums">{pages}</span></> : null}</p>
          <OpportunityList items={items} signedIn={Boolean(user)} returnTo={returnTo} />
          <Pagination page={params.page} pages={pages} hrefFor={(n) => buildOpportunityHref({ page: n }, params)} />
        </>
      )}
    </div>
  );
}
