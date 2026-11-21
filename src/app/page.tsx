import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, Compass, MessageSquare,
  Search, Sparkles, Users, Rocket, Globe2, CalendarClock, TrendingUp,
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { StartupGrid } from "@/components/startups/startup-card";
import { StartupLogo } from "@/components/startups/startup-logo";
import { getUser } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { getHomeData } from "@/lib/startups/queries";
import { LaunchList } from "@/components/launches/launch-card";
import { OpportunityList } from "@/components/opportunities/opportunity-card";
import { Alert } from "@/components/ui/alert";
import { getOpenForHome, type OpportunityCardData } from "@/lib/opportunities/queries";
import { getTrendingForHome, getUpcomingForHome, getPopularStartups, type LaunchCardData } from "@/lib/launches/queries";
import { listCommunityThreads, type CommunityThread } from "@/lib/community/queries";
import { communityCategoryLabel } from "@/lib/community/constants";
import { formatDate } from "@/lib/format";

const log = createLogger("home");

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { notice } = await searchParams;
  const user = await getUser();
  let data: Awaited<ReturnType<typeof getHomeData>> = { featured: [], recent: [], categories: [] };
  try { data = await getHomeData(); } catch (err) { log.error("home data failed", err); }
  let trending: LaunchCardData[] = [];
  let upcoming: LaunchCardData[] = [];
  let popular: Awaited<ReturnType<typeof getPopularStartups>> = [];
  let opportunities: OpportunityCardData[] = [];
  let discussions: CommunityThread[] = [];
  try { trending = await getTrendingForHome(user?.id ?? null, 5); } catch (err) { log.error("trending launches failed", err); }
  try { upcoming = await getUpcomingForHome(user?.id ?? null, 4); } catch (err) { log.error("upcoming launches failed", err); }
  try { popular = await getPopularStartups(4); } catch (err) { log.error("popular startups failed", err); }
  try { opportunities = await getOpenForHome(3); } catch (err) { log.error("opportunities preview failed", err); }
  try { discussions = (await listCommunityThreads()).slice(0, 3); } catch (err) { log.error("community preview failed", err); }
  const { featured, recent, categories } = data;
  const populated = categories.filter((c) => c.startup_count > 0);
  const newest = recent.slice(0, 4);

  return (
    <>
      {notice === "account_deleted" ? <div className="container-page pt-5"><Alert tone="success">Your account has been deleted. Thanks for being part of Buna.</Alert></div> : null}

      <section className="border-b border-line bg-primary-pale">
        <div className="container-page py-8 sm:py-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-deep">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-surface px-3 py-1.5"><Globe2 className="h-3.5 w-3.5" /> Ethiopia first · Africa connected</span>
            <span className="text-muted">The home of African startup discovery</span>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">Find the people building what comes next.</h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">Discover startups emerging from Ethiopia and across Africa. Meet the founders, follow new launches, find opportunities and help promising work get noticed.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/startups" className={buttonStyles("primary","lg")}>Explore startups <ArrowRight className="h-4 w-4" /></Link>
              <Link href={user ? "/dashboard/startup/new" : "/signup?next=%2Fdashboard%2Fstartup%2Fnew"} className={buttonStyles("secondary","lg")}>Submit your startup <Rocket className="h-4 w-4" /></Link>
            </div>
          </div>
          <form action="/startups" method="get" role="search" aria-label="Search Buna" className="mt-6 flex max-w-3xl flex-col gap-2 sm:flex-row">
            <label htmlFor="home-q" className="sr-only">Search startups, founders and products</label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input id="home-q" name="q" type="search" maxLength={80} placeholder="Search startups by name, product or what they build…" className="h-12 w-full rounded-lg border border-line bg-surface pl-11 pr-4 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
            </div>
            <Button type="submit" size="lg">Search Buna</Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="font-semibold text-muted">Explore:</span>
            <Link href="/startups" className="font-medium text-ink hover:text-primary">Startups</Link>
            <Link href="/founders" className="font-medium text-ink hover:text-primary">Founders</Link>
            <Link href="/launches" className="font-medium text-ink hover:text-primary">Launches</Link>
            <Link href="/community" className="font-medium text-ink hover:text-primary">Community</Link>
            <Link href="/opportunities" className="font-medium text-ink hover:text-primary">Opportunities</Link>
          </div>
        </div>
      </section>

      <section className="container-page py-6 sm:py-8" aria-label="Discover the ecosystem">
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_270px] lg:items-start">
          <aside className="order-2 space-y-5 lg:order-1">
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Browse categories</h2><Compass className="h-4 w-4 text-primary" /></div>
              {populated.length ? (
                <ul className="space-y-1">
                  {populated.slice(0, 12).map((category) => (
                    <li key={category.slug}><Link href={`/startups?category=${category.slug}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-ink no-underline hover:bg-primary-pale hover:text-primary"><span className="truncate">{category.name}</span><span className="shrink-0 text-xs tabular-nums text-muted">{category.startup_count}</span></Link></li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg bg-primary-pale/60 p-3"><p className="text-sm text-muted">Startup categories are being populated. Browse the full directory to explore what’s listed.</p></div>
              )}
              <Link href="/startups" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">All categories <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="rounded-xl border border-line bg-primary-pale p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-deep">For founders</p>
              <h2 className="mt-2 font-bold">Put your work on the map.</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">Create a public home for your startup, meet collaborators and reach people looking for what Africa is building.</p>
              <Link href={user ? "/dashboard/startup/new" : "/signup?next=%2Fdashboard%2Fstartup%2Fnew"} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Add your startup <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">For investors</p>
              <h2 className="mt-2 font-bold">See the ecosystem earlier.</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">Explore companies, learn who is building and connect with founders across the market.</p>
              <Link href="/investors" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Explore investor network <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
          </aside>

          <div className="order-1 min-w-0 space-y-7 lg:order-2">
            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">The live ecosystem</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Trending launches</h2><p className="mt-1 text-sm text-muted">New products and ideas making their debut.</p></div>
                <Link href="/launches" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all launches <ArrowRight className="h-4 w-4" /></Link>
              </div>
              {trending.length ? <LaunchList launches={trending} signedIn={Boolean(user)} /> : (
                <div className="rounded-xl border border-dashed border-line bg-surface p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-pale text-primary"><Rocket className="h-5 w-5" /></span><div><h3 className="font-semibold">The next big launch could come from here.</h3><p className="mt-1 text-sm leading-relaxed text-muted">There are no live launches at the moment. Explore the startup directory or be the first to submit a product.</p><Link href={user ? "/launches/submit" : "/signup?next=%2Flaunches%2Fsubmit"} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Submit a launch <ArrowRight className="h-4 w-4" /></Link></div></div></div>
              )}
            </div>

            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Handpicked discoveries</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Featured startups</h2></div><Link href="/startups?sort=featured" className="text-sm font-semibold text-primary hover:underline">Explore featured <ArrowRight className="inline h-4 w-4" /></Link></div>
              {featured.length ? <StartupGrid startups={featured.slice(0, 4)} /> : <div className="rounded-lg border border-dashed border-line p-5"><p className="text-sm text-muted">Featured companies will appear here as Buna highlights standout startups. In the meantime, explore the full directory.</p><Link href="/startups" className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline">Browse startups <ArrowRight className="ml-1 h-4 w-4" /></Link></div>}
            </div>

            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Community momentum</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Popular startups</h2><p className="mt-1 text-sm text-muted">Ranked by votes on their published launches.</p></div><Link href="/startups" className="text-sm font-semibold text-primary hover:underline">Full directory <ArrowRight className="inline h-4 w-4" /></Link></div>
              {popular.length ? <StartupGrid startups={popular} /> : <div className="rounded-lg border border-dashed border-line p-5"><p className="text-sm text-muted">As more founders launch and the community votes, the most-supported startups will appear here.</p></div>}
            </div>

            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Fresh additions</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Recently added startups</h2></div><Link href="/startups" className="text-sm font-semibold text-primary hover:underline">Browse all <ArrowRight className="inline h-4 w-4" /></Link></div>
              {recent.length ? <StartupGrid startups={recent.slice(0, 4)} /> : <div className="rounded-lg border border-dashed border-line p-5"><p className="text-sm text-muted">The public directory is growing. Add your company and help people discover what is being built.</p><Link href={user ? "/dashboard/startup/new" : "/signup?next=%2Fdashboard%2Fstartup%2Fnew"} className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline">Add a startup <ArrowRight className="ml-1 h-4 w-4" /></Link></div>}
            </div>
          </div>

          <aside className="order-3 space-y-5">
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Just added</h2><Sparkles className="h-4 w-4 text-primary" /></div>
              {newest.length ? <ul className="divide-y divide-line">{newest.map((startup) => <li key={startup.id} className="relative flex items-center gap-3 py-3 first:pt-0 last:pb-0"><StartupLogo name={startup.name} src={startup.logo_url} size={40} /><div className="min-w-0"><Link href={`/startups/${startup.slug}`} className="font-semibold text-sm text-ink no-underline hover:text-primary">{startup.name}</Link><p className="truncate text-xs text-muted">{startup.tagline || startup.category?.name || "African startup"}</p></div></li>)}</ul> : <p className="text-sm text-muted">New startup profiles will appear here as founders publish them.</p>}
              <Link href="/startups" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">See all startups <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>

            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Upcoming launches</h2><CalendarClock className="h-4 w-4 text-primary" /></div>
              {upcoming.length ? <ul className="space-y-3">{upcoming.map((launch) => <li key={launch.id} className="border-b border-line pb-3 last:border-0 last:pb-0"><Link href={`/launches/${launch.slug}`} className="font-semibold text-sm text-ink no-underline hover:text-primary">{launch.name}</Link><p className="mt-1 line-clamp-2 text-xs text-muted">{launch.tagline}</p><p className="mt-2 text-xs font-medium text-primary">{launch.launch_date ? formatDate(launch.launch_date) : "Coming soon"}</p></li>)}</ul> : <div className="rounded-lg bg-primary-pale/60 p-3"><p className="text-sm text-muted">No launches are scheduled yet. Check back to see what founders are preparing.</p></div>}
              <Link href="/launches?period=upcoming" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Launch calendar <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>

            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Meet the founders</h2><Users className="h-4 w-4 text-primary" /></div>
              <p className="text-sm leading-relaxed text-muted">Discover the people behind the companies, explore their work and find your next collaborator.</p>
              <Link href="/founders" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Browse founder directory <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="container-page pb-10" aria-label="More ways to participate">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-pale text-primary"><MessageSquare className="h-5 w-5" /></div><h2 className="mt-3 font-bold">Join the conversation</h2><p className="mt-1 text-sm text-muted">Ask questions, exchange practical advice and learn from people building across the ecosystem.</p><Link href="/community" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Explore community <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="rounded-xl border border-line bg-surface p-5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-pale text-primary"><BriefcaseBusiness className="h-5 w-5" /></div><h2 className="mt-3 font-bold">Find opportunities</h2><p className="mt-1 text-sm text-muted">Explore roles, grants, funding, co-founder connections and ways to contribute.</p><Link href="/opportunities" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Browse opportunities <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="rounded-xl border border-line bg-surface p-5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-pale text-primary"><TrendingUp className="h-5 w-5" /></div><h2 className="mt-3 font-bold">Track the ecosystem</h2><p className="mt-1 text-sm text-muted">See what is gaining attention, follow launches and keep up with the companies shaping the market.</p><Link href="/launches" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">See what’s moving <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      {discussions.length ? (
        <section className="container-page pb-12" aria-labelledby="community-preview-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">From the community board</p><h2 id="community-preview-heading" className="mt-1 text-xl font-bold sm:text-2xl">Conversations worth joining</h2></div><Link href="/community" className="text-sm font-semibold text-primary hover:underline">View discussions <ArrowRight className="inline h-4 w-4" /></Link></div>
          <ul className="grid gap-3 md:grid-cols-3">{discussions.map((thread) => <li key={thread.id} className="rounded-xl border border-line bg-surface p-4"><div className="flex items-center justify-between gap-2 text-xs text-muted"><span className="rounded-full bg-primary-pale px-2 py-1 font-medium text-primary-deep">{communityCategoryLabel(thread.category)}</span><span>{thread.reply_count} replies</span></div><h3 className="mt-3 font-semibold leading-snug"><Link href={`/community/${thread.id}`} className="text-ink no-underline hover:underline">{thread.title}</Link></h3><p className="mt-2 line-clamp-2 text-sm text-muted">{thread.body}</p><p className="mt-3 border-t border-line pt-3 text-xs text-muted">Started by {thread.author?.display_name || "Buna member"}</p></li>)}</ul>
        </section>
      ) : (
        <section className="container-page pb-12" aria-labelledby="community-preview-heading">
          <div className="rounded-xl border border-dashed border-line p-5 sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Community board</p><h2 id="community-preview-heading" className="mt-1 text-lg font-bold">Good ideas grow through conversation.</h2><p className="mt-1 text-sm text-muted">Visit the discussion board to ask questions and exchange practical knowledge with the ecosystem.</p></div><Link href="/community" className={buttonStyles("secondary","md","mt-3 sm:mt-0")}>Explore discussions <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
      )}

      {opportunities.length ? (
        <section className="container-page pb-14" aria-labelledby="opps-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Build your next step</p><h2 id="opps-heading" className="mt-1 text-xl font-bold sm:text-2xl">Open opportunities</h2></div><Link href="/opportunities" className="text-sm font-semibold text-primary hover:underline">All opportunities <ArrowRight className="inline h-4 w-4" /></Link></div>
          <OpportunityList items={opportunities} signedIn={Boolean(user)} returnTo="/" />
        </section>
      ) : (
        <section className="container-page pb-14" aria-labelledby="opps-heading">
          <div className="rounded-xl border border-dashed border-line p-5 sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Opportunities</p><h2 id="opps-heading" className="mt-1 text-lg font-bold">Find a way to contribute.</h2><p className="mt-1 text-sm text-muted">Roles, grants, funding and collaboration opportunities are collected in one place.</p></div><Link href="/opportunities" className={buttonStyles("secondary","md","mt-3 sm:mt-0")}>Browse opportunities <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
      )}
    </>
  );
}
