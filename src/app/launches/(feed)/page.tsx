import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/illustrations";
import { Alert } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { LaunchFilters } from "@/components/launches/launch-filters";
import { LaunchList } from "@/components/launches/launch-card";
import { Pagination } from "@/components/startups/pagination";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { LAUNCH_PAGE_SIZE, LAUNCH_SORTS } from "@/lib/launches/constants";
import { buildLaunchHref, hasActiveLaunchFilters, parseLaunchParams } from "@/lib/launches/params";
import { listLaunches, type LaunchCardData } from "@/lib/launches/queries";
import { listCategories, type CategoryOption } from "@/lib/startups/queries";

const log = createLogger("launch-feed");
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const p = parseLaunchParams(await searchParams);
  return {
    title: "Daily Launch Arena",
    description: "Discover and vote for products from African startups in Buna’s daily 24-hour launch competition.",
    alternates: { canonical: "/launches" },
    robots: hasActiveLaunchFilters(p) || p.page > 1 || p.sort !== "today" ? { index: false, follow: true } : undefined,
  };
}

export default async function LaunchesPage({ searchParams }: { searchParams: SP }) {
  const params = parseLaunchParams(await searchParams);
  const user = await getUser();
  let categories: CategoryOption[] = [];
  let items: LaunchCardData[] = [];
  let total = 0;
  let failed = false;
  try {
    categories = await listCategories();
    ({ items, total } = await listLaunches(params, categories, user?.id ?? null));
  } catch (err) {
    log.error("launch feed failed", err);
    failed = true;
  }
  const pages = Math.max(1, Math.ceil(total / LAUNCH_PAGE_SIZE));
  if (!failed && total > 0 && params.page > pages) redirect(buildLaunchHref({ page: pages }, params));
  const filtered = hasActiveLaunchFilters(params);
  const sort = LAUNCH_SORTS.find((s) => s.value === params.sort);

  return (
    <div className="container-page space-y-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Daily Launch Arena</h1>
          <p className="mt-2 max-w-2xl text-muted">Discover products from African startups. {sort?.hint}. Each launch competes for 24 hours, then remains in the permanent archive.</p>
        </div>
        <Link href={user ? "/launches/submit" : "/login?next=/launches/submit"} className={buttonStyles("primary", "md")}><Plus className="h-4 w-4" aria-hidden="true" />Submit a launch</Link>
      </div>
      <LaunchFilters params={params} categories={categories} />

      {failed ? (
        <Alert tone="error" title="We couldn’t load launches">Something went wrong on our side. <Link href={buildLaunchHref({}, params)} className="font-medium">Try again</Link>.</Alert>
      ) : !isSupabaseConfigured() ? (
        <Alert tone="warning" title="Not connected yet">This site isn’t connected to its database, so there’s nothing to show.</Alert>
      ) : items.length === 0 ? (
        <EmptyState illustration={filtered ? "search" : "launches"} title={filtered ? "No launches match those filters" : params.sort === "upcoming" ? "No upcoming launches" : params.sort === "featured" ? "Nothing is featured right now" : params.sort === "archive" ? "No past editions yet" : "No launches yet"}
          action={filtered ? <Link href="/launches" className={buttonStyles("secondary", "md")}>Clear all filters</Link> : <Link href={user ? "/launches/submit" : "/login?next=/launches/submit"} className={buttonStyles("primary", "md")}>Submit a launch</Link>}>
          {filtered ? "Try a broader search or remove a filter." : "Be the first to show what you’re building."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            <span className="tabular-nums">{total}</span> {total === 1 ? "launch" : "launches"}{params.page > 1 ? <> · page <span className="tabular-nums">{params.page}</span> of <span className="tabular-nums">{pages}</span></> : null}
          </p>
          <LaunchList launches={items} signedIn={Boolean(user)} groupByDay={params.sort === "archive"} />
          <Pagination page={params.page} pages={pages} hrefFor={(n) => buildLaunchHref({ page: n }, params)} />
        </>
      )}
    </div>
  );
}
