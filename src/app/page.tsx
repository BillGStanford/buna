import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { StartupGrid } from "@/components/startups/startup-card";
import { getUser } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { getHomeData } from "@/lib/startups/queries";
import { LaunchList } from "@/components/launches/launch-card";
import { HeroIllustration } from "@/components/illustrations";
import { OpportunityList } from "@/components/opportunities/opportunity-card";
import { Alert } from "@/components/ui/alert";
import { getOpenForHome, type OpportunityCardData } from "@/lib/opportunities/queries";
import { getTrendingForHome, type LaunchCardData } from "@/lib/launches/queries";

const log = createLogger("home");

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { notice } = await searchParams;
  const user = await getUser();
  let data: Awaited<ReturnType<typeof getHomeData>> = { featured: [], recent: [], categories: [] };
  try {
    data = await getHomeData();
  } catch (err) {
    // The homepage must render even if the database is briefly unavailable.
    log.error("home data failed", err);
  }
  let trending: LaunchCardData[] = [];
  try {
    trending = await getTrendingForHome(user?.id ?? null, 5);
  } catch (err) {
    log.error("trending launches failed", err);
  }
  let opportunities: OpportunityCardData[] = [];
  try {
    opportunities = await getOpenForHome(3);
  } catch (err) {
    log.error("opportunities preview failed", err);
  }
  const { featured, recent, categories } = data;
  const populated = categories.filter((c) => c.startup_count > 0);

  return (
    <>
      {notice === "account_deleted" ? <div className="container-page pt-6"><Alert tone="success">Your account has been deleted. Thanks for being part of Buna.</Alert></div> : null}
      <section className="border-b border-line bg-primary-pale">
        <div className="container-page grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Where African startups get found.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Buna is a home for African technology startups. Publish your company, show what you’re building, and meet the customers,
              collaborators and investors looking for you — starting in Ethiopia.
            </p>
            <form action="/startups" method="get" role="search" aria-label="Search startups" className="mt-7 flex max-w-xl flex-col gap-2 sm:flex-row">
              <label htmlFor="home-q" className="sr-only">Search startups</label>
              <input id="home-q" name="q" type="search" maxLength={80} placeholder="Search startups by name or what they build"
                className="h-12 flex-1 rounded-md border border-line bg-surface px-4 text-base placeholder:text-muted/70 hover:border-primary/40" />
              <Button type="submit" size="lg"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
            </form>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/startups" className={buttonStyles("secondary", "md")}>Explore startups</Link>
              <Link href={user ? "/dashboard/startup/new" : "/signup"} className={buttonStyles("ghost", "md")}>
                Submit a startup <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <HeroIllustration className="mx-auto w-full max-w-lg" />
        </div>
      </section>

      {trending.length > 0 ? (
        <section className="container-page pt-12" aria-labelledby="trending-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="trending-heading" className="text-2xl font-bold">Trending launches</h2>
            <Link href="/launches" className="text-sm font-medium">See all launches</Link>
          </div>
          <LaunchList launches={trending} signedIn={Boolean(user)} />
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section className="container-page pt-12" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="mb-4 text-2xl font-bold">Featured</h2>
          <StartupGrid startups={featured} />
        </section>
      ) : null}

      <section className="container-page pt-12" aria-labelledby="recent-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 id="recent-heading" className="text-2xl font-bold">Recently added</h2>
          {recent.length > 0 ? <Link href="/startups" className="text-sm font-medium">See all startups</Link> : null}
        </div>
        {recent.length > 0 ? (
          <StartupGrid startups={recent} />
        ) : (
          <div className="rounded-lg border border-dashed border-line p-8">
            <h3 className="text-lg font-semibold">No startups have been published yet</h3>
            <p className="mt-1 max-w-lg text-sm text-muted">The directory fills up as founders publish their companies. Yours can be the first.</p>
            <Link href={user ? "/dashboard/startup/new" : "/signup"} className={buttonStyles("primary", "md", "mt-4")}>Add your startup</Link>
          </div>
        )}
      </section>

      {opportunities.length > 0 ? (
        <section className="container-page pt-12" aria-labelledby="opps-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="opps-heading" className="text-2xl font-bold">Open opportunities</h2>
            <Link href="/opportunities" className="text-sm font-medium">See all opportunities</Link>
          </div>
          <OpportunityList items={opportunities} signedIn={Boolean(user)} returnTo="/" />
        </section>
      ) : null}

      {populated.length > 0 ? (
        <section className="container-page pt-12" aria-labelledby="sectors-heading">
          <h2 id="sectors-heading" className="mb-4 text-2xl font-bold">Browse by sector</h2>
          <ul className="flex flex-wrap gap-2">
            {populated.map((c) => (
              <li key={c.slug}>
                <Link href={`/startups?category=${c.slug}`} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink no-underline hover:border-primary/40 hover:bg-primary-mint">
                  {c.name}<span className="tabular-nums text-muted">{c.startup_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="container-page py-14" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Create your account", "Sign up with your email and confirm it. It takes a minute."],
            ["Add your startup", "Describe what you build, add your logo, products and links, and preview it before anyone else sees it."],
            ["Publish and share", "Publish when you’re ready and share your profile link with customers, partners and investors."],
          ].map(([title, text], i) => (
            <li key={title} className="rounded-lg border border-line p-5">
              <span className="text-sm font-semibold tabular-nums text-primary">Step {i + 1}</span>
              <h3 className="mt-1 text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-lg bg-primary-pale p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-xl font-bold">Building something in Africa?</h2>
            <p className="mt-1 text-sm text-muted">Bootstrapped, university-born or early-stage — if you’re building, you belong here.</p>
          </div>
          <Link href={user ? "/dashboard/startup/new" : "/signup"} className={buttonStyles("primary", "lg", "mt-4 sm:mt-0")}>Submit your startup</Link>
        </div>
      </section>
    </>
  );
}
