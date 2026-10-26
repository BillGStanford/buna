import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/illustrations";
import { Alert } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { DirectoryFilters } from "@/components/startups/directory-filters";
import { Pagination } from "@/components/startups/pagination";
import { StartupGrid } from "@/components/startups/startup-card";
import { DIRECTORY_PAGE_SIZE } from "@/lib/startups/constants";
import { buildDirectoryHref, hasActiveFilters, parseDirectoryParams } from "@/lib/startups/params";
import { listCategories, listStartups, type CategoryOption, type StartupCardData } from "@/lib/startups/queries";
import { createLogger } from "@/lib/logger";
import { isSupabaseConfigured } from "@/lib/env";

const log = createLogger("directory");

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const p = parseDirectoryParams(await searchParams);
  return {
    title: "Discover African startups",
    description: "Browse African technology startups by sector, country and stage. Find products, founders and teams building across the continent.",
    alternates: { canonical: "/startups" },
    // Search and filter result pages are for people, not for the index.
    robots: hasActiveFilters(p) || p.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function StartupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = parseDirectoryParams(await searchParams);
  let categories: CategoryOption[] = [];
  let items: StartupCardData[] = [];
  let total = 0;
  let failed = false;

  try {
    categories = await listCategories();
    ({ items, total } = await listStartups(params, categories));
  } catch (err) {
    log.error("directory query failed", err);
    failed = true;
  }

  const pages = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
  if (!failed && total > 0 && params.page > pages) redirect(buildDirectoryHref({ page: pages }, params));
  const filtered = hasActiveFilters(params);

  return (
    <div className="container-page space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Discover startups</h1>
        <p className="mt-2 max-w-2xl text-muted">Technology companies building in Africa. Information is provided by each startup unless it is marked verified.</p>
      </div>
      <DirectoryFilters params={params} categories={categories} />

      {failed ? (
        <Alert tone="error" title="We couldn’t load startups">
          Something went wrong on our side. <Link href={buildDirectoryHref({}, params)} className="font-medium">Try again</Link>.
        </Alert>
      ) : !isSupabaseConfigured() ? (
        <Alert tone="warning" title="Not connected yet">This site isn’t connected to its database, so there’s nothing to show.</Alert>
      ) : items.length === 0 ? (
        <EmptyState illustration={filtered ? "search" : "startups"} title={filtered ? "No startups match those filters" : "No startups have been published yet"}
          action={filtered ? <Link href="/startups" className={buttonStyles("secondary", "md")}>Clear all filters</Link> : <Link href="/dashboard/startup/new" className={buttonStyles("primary", "md")}>Add your startup</Link>}>
          {filtered ? "Try a broader search, remove a filter, or check the spelling." : "Be the first — publish your startup and it will appear here."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            <span className="tabular-nums">{total}</span> {total === 1 ? "startup" : "startups"}
            {params.page > 1 ? <> · page <span className="tabular-nums">{params.page}</span> of <span className="tabular-nums">{pages}</span></> : null}
          </p>
          <StartupGrid startups={items} />
          <Pagination page={params.page} pages={pages} hrefFor={(n) => buildDirectoryHref({ page: n }, params)} />
        </>
      )}
    </div>
  );
}
