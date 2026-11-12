import Link from "next/link";
import { ArrowRight, ArrowUpRight, MessageSquare, Search, Users, BriefcaseBusiness, Rocket, Compass } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { StartupGrid } from "@/components/startups/startup-card";
import { getUser } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { getHomeData } from "@/lib/startups/queries";
import { LaunchList } from "@/components/launches/launch-card";
import { OpportunityList } from "@/components/opportunities/opportunity-card";
import { Alert } from "@/components/ui/alert";
import { getOpenForHome, type OpportunityCardData } from "@/lib/opportunities/queries";
import { getTrendingForHome, type LaunchCardData } from "@/lib/launches/queries";
import { listCommunityThreads, type CommunityThread } from "@/lib/community/queries";
import { communityCategoryLabel } from "@/lib/community/constants";

const log = createLogger("home");

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { notice } = await searchParams;
  const user = await getUser();
  let data: Awaited<ReturnType<typeof getHomeData>> = { featured: [], recent: [], categories: [] };
  try { data = await getHomeData(); } catch (err) { log.error("home data failed", err); }
  let trending: LaunchCardData[] = [];
  try { trending = await getTrendingForHome(user?.id ?? null, 5); } catch (err) { log.error("trending launches failed", err); }
  let opportunities: OpportunityCardData[] = [];
  try { opportunities = await getOpenForHome(3); } catch (err) { log.error("opportunities preview failed", err); }
  let discussions: CommunityThread[] = [];
  try { discussions = (await listCommunityThreads()).slice(0, 3); } catch (err) { log.error("community preview failed", err); }
  const { featured, recent, categories } = data;
  const populated = categories.filter((c) => c.startup_count > 0);

  return (
    <>
      {notice === "account_deleted" ? <div className="container-page pt-6"><Alert tone="success">Your account has been deleted. Thanks for being part of Buna.</Alert></div> : null}

      <section className="border-b border-line bg-primary-pale">
        <div className="container-page grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-deep"><span className="h-2 w-2 rounded-full bg-primary" /> The African startup ecosystem, connected</p>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Discover what’s being built in Africa.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Find startups, follow new launches, meet founders and discover the people and opportunities that help businesses grow — starting in Ethiopia.
            </p>
            <form action="/startups" method="get" role="search" aria-label="Search Buna" className="mt-7 flex max-w-xl flex-col gap-2 sm:flex-row">
              <label htmlFor="home-q" className="sr-only">Search startups</label>
              <input id="home-q" name="q" type="search" maxLength={80} placeholder="Search startups by name or what they build"
                className="h-12 flex-1 rounded-md border border-line bg-surface px-4 text-base placeholder:text-muted/70 hover:border-primary/40" />
              <Button type="submit" size="lg"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
            </form>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/startups" className={buttonStyles("secondary", "md")}>Explore startups</Link>
              <Link href={user ? "/dashboard/startup/new" : "/signup"} className={buttonStyles("ghost", "md")}>Submit a startup <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/launches" className="group rounded-xl border border-line bg-surface p-5 no-underline transition-colors hover:border-primary/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-pale text-primary"><Rocket className="h-5 w-5" /></span>
              <h2 className="mt-4 font-semibold text-ink">Launch something</h2><p className="mt-1 text-sm text-muted">Put your product in front of the ecosystem.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Explore launches <ArrowUpRight className="h-4 w-4" /></span>
            </Link>
            <Link href="/community" className="group rounded-xl border border-line bg-surface p-5 no-underline transition-colors hover:border-primary/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-pale text-primary"><Users className="h-5 w-5" /></span>
              <h2 className="mt-4 font-semibold text-ink">Meet the community</h2><p className="mt-1 text-sm text-muted">Ask questions and build with other founders.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Join discussions <ArrowUpRight className="h-4 w-4" /></span>
            </Link>
            <Link href="/opportunities" className="group rounded-xl border border-line bg-surface p-5 no-underline transition-colors hover:border-primary/50 sm:col-span-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-pale text-primary"><BriefcaseBusiness className="h-5 w-5" /></span>
              <h2 className="mt-4 font-semibold text-ink">Find your next opportunity</h2><p className="mt-1 text-sm text-muted">Discover roles, funding, co-founder connections and ways to contribute.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Explore opportunities <ArrowUpRight className="h-4 w-4" /></span>
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page pt-12" aria-labelledby="launches-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">The daily competition</p><h2 id="launches-heading" className="mt-1 text-2xl font-bold">Today’s launches</h2><p className="mt-1 text-sm text-muted">Discover new products. Cast a vote. Help the strongest work rise.</p></div>
          <Link href="/launches" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">All launches <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {trending.length ? <LaunchList launches={trending} signedIn={Boolean(user)} /> : (
          <div className="rounded-lg border border-dashed border-line bg-surface p-6 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div><h3 className="font-semibold">The next launch can be yours.</h3><p className="mt-1 text-sm text-muted">No products are competing today yet. Be among the first to introduce what you’re building.</p></div>
            <Link href={user ? "/launches/submit" : "/signup"} className={buttonStyles("primary", "md", "mt-4 sm:mt-0")}>Submit a launch</Link>
          </div>
        )}
      </section>

      {discussions.length > 0 ? (
        <section className="container-page pt-14" aria-labelledby="community-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">From the community</p><h2 id="community-heading" className="mt-1 text-2xl font-bold">Conversations worth joining</h2><p className="mt-1 text-sm text-muted">Practical questions and answers from people building across Africa.</p></div>
            <Link href="/community" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Visit community <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {discussions.map((thread) => (
              <li key={thread.id} className="rounded-lg border border-line bg-surface p-5 transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between gap-2 text-xs text-muted"><span className="rounded-full bg-primary-pale px-2 py-1 font-medium text-primary-deep">{communityCategoryLabel(thread.category)}</span><span>{thread.reply_count} replies</span></div>
                <h3 className="mt-3 line-clamp-2 font-semibold leading-snug"><Link href={`/community/${thread.id}`} className="text-ink no-underline hover:underline">{thread.title}</Link></h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{thread.body}</p>
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Started by {thread.author?.display_name || "Buna member"}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section className="container-page pt-14" aria-labelledby="featured-heading">
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Selected companies</p><h2 id="featured-heading" className="mt-1 text-2xl font-bold">Featured startups</h2></div><Link href="/startups?sort=featured" className="text-sm font-medium hover:underline">Explore directory</Link></div>
          <StartupGrid startups={featured} />
        </section>
      ) : null}

      <section className="container-page pt-14" aria-labelledby="recent-heading">
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">The ecosystem</p><h2 id="recent-heading" className="mt-1 text-2xl font-bold">Recently added startups</h2></div>{recent.length > 0 ? <Link href="/startups" className="text-sm font-medium hover:underline">Browse all <ArrowRight className="inline h-4 w-4" /></Link> : null}</div>
        {recent.length ? <StartupGrid startups={recent} /> : (
          <div className="rounded-lg border border-dashed border-line p-8"><h3 className="text-lg font-semibold">Help build the directory.</h3><p className="mt-1 max-w-lg text-sm text-muted">The ecosystem becomes more useful with every real company added. Publish yours and help others find you.</p><Link href={user ? "/dashboard/startup/new" : "/signup"} className={buttonStyles("primary", "md", "mt-4")}>Add your startup</Link></div>
        )}
      </section>

      {opportunities.length > 0 ? (
        <section className="container-page pt-14" aria-labelledby="opps-heading">
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Build your next step</p><h2 id="opps-heading" className="mt-1 text-2xl font-bold">Open opportunities</h2><p className="mt-1 text-sm text-muted">Find a role, a grant, a partner or a way into the ecosystem.</p></div><Link href="/opportunities" className="text-sm font-medium hover:underline">All opportunities <ArrowRight className="inline h-4 w-4" /></Link></div>
          <OpportunityList items={opportunities} signedIn={Boolean(user)} returnTo="/" />
        </section>
      ) : null}

      {populated.length > 0 ? (
        <section className="container-page pt-14" aria-labelledby="sectors-heading">
          <div className="mb-4 flex items-center gap-2"><Compass className="h-5 w-5 text-primary" /><h2 id="sectors-heading" className="text-2xl font-bold">Explore by sector</h2></div>
          <ul className="flex flex-wrap gap-2">{populated.map((c) => <li key={c.slug}><Link href={`/startups?category=${c.slug}`} className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink no-underline hover:border-primary/40 hover:bg-primary-mint">{c.name}<span className="tabular-nums text-muted">{c.startup_count}</span></Link></li>)}</ul>
        </section>
      ) : null}

      <section className="container-page py-14" aria-labelledby="ecosystem-heading">
        <div className="rounded-xl border border-line bg-primary-pale p-7 sm:p-9">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-wider text-primary-deep">A stronger ecosystem is built together</p><h2 id="ecosystem-heading" className="mt-2 text-2xl font-bold sm:text-3xl">Your work deserves to be found. Your next collaborator is here.</h2><p className="mt-3 text-sm leading-relaxed text-muted">Whether you’re building a company, looking for talent, seeking capital or sharing your skills, Buna gives the African startup ecosystem a place to connect.</p></div>
          <div className="mt-6 flex flex-wrap gap-3"><Link href={user ? "/dashboard/startup/new" : "/signup"} className={buttonStyles("primary", "lg")}>Join Buna <ArrowRight className="h-4 w-4" /></Link><Link href="/community" className={buttonStyles("secondary", "lg")}><MessageSquare className="h-4 w-4" />Talk with the community</Link></div>
        </div>
      </section>
    </>
  );
}
