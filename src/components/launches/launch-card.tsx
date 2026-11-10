import Link from "next/link";
import { CalendarClock, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StartupLogo } from "@/components/startups/startup-logo";
import { VoteButton } from "./vote-button";
import { formatDate } from "@/lib/format";
import type { LaunchCardData } from "@/lib/launches/queries";

export function LaunchCard({ launch, signedIn, rank }: { launch: LaunchCardData; signedIn: boolean; rank?: number }) {
  const upcoming = launch.status === "scheduled";
  const maker = launch.maker;
  const remainingMs = launch.competition_ends_at ? new Date(launch.competition_ends_at).getTime() - Date.now() : 0;
  const remainingHours = Math.max(0, Math.floor(remainingMs / 3_600_000));
  const remainingMinutes = Math.max(0, Math.floor((remainingMs % 3_600_000) / 60_000));
  return (
    <li className="group relative flex items-start gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-primary-pale">
      <div className="flex shrink-0 flex-col items-center gap-1"><StartupLogo name={launch.name} src={launch.logo_url ?? launch.startup?.logo_url} size={56} />{rank ? <span className="text-xs font-semibold tabular-nums text-muted">#{rank}</span> : null}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold leading-snug">
            <Link href={`/launches/${launch.slug}`} data-analytics-event="launch_view" className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline">{launch.name}</Link>
          </h3>
          {launch.is_featured ? <Badge tone="green">Featured</Badge> : null}
          {launch.is_demo ? <Badge tone="warning">Demo</Badge> : null}
          {upcoming ? <Badge tone="warning"><CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />{launch.launch_date ? formatDate(launch.launch_date) : "Soon"}</Badge> : null}
          {!upcoming && launch.competition_ends_at ? <Badge tone={remainingMs > 0 ? "green" : "neutral"}>{remainingMs > 0 ? `Ends in ${remainingHours}h ${remainingMinutes}m` : "Competition complete"}</Badge> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{launch.tagline}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {launch.category ? <Badge>{launch.category.name}</Badge> : null}
          {launch.tags.slice(0, 3).map((t) => (
            <Link key={t} href={`/launches?tag=${encodeURIComponent(t)}`} className="relative z-10 text-muted no-underline hover:text-primary hover:underline">#{t}</Link>
          ))}
          {maker ? <span>by <Link href={`/users/${maker.username}`} className="relative z-10 font-medium text-ink no-underline hover:underline">{maker.display_name || `@${maker.username}`}</Link></span> : null}
          {launch.startup ? <Link href={`/startups/${launch.startup.slug}`} className="relative z-10 text-muted no-underline hover:underline">{launch.startup.name}</Link> : null}
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /><span className="tabular-nums">{launch.comment_count}</span><span className="sr-only"> comments</span></span>
        </div>
      </div>
      <div className="relative z-10">
        <VoteButton launchId={launch.id} name={launch.name} count={launch.vote_count} voted={launch.voted} signedIn={signedIn}
          loginHref={`/login?next=${encodeURIComponent("/launches")}`}
          disabledReason={upcoming ? "Voting opens when this launch goes live" : undefined} />
      </div>
    </li>
  );
}

export function LaunchList({ launches, signedIn, groupByDay = false }: { launches: LaunchCardData[]; signedIn: boolean; groupByDay?: boolean }) {
  if (!groupByDay) return <ul className="space-y-3">{launches.map((l, index) => <LaunchCard key={l.id} launch={l} signedIn={signedIn} rank={index + 1} />)}</ul>;
  const groups = new Map<string, LaunchCardData[]>();
  for (const launch of launches) {
    const day = launch.competition_day ?? "Earlier editions";
    groups.set(day, [...(groups.get(day) ?? []), launch]);
  }
  return <div className="space-y-8">{[...groups.entries()].map(([day, items]) => (
    <section key={day} aria-labelledby={`edition-${day}`} className="space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-2"><h2 id={`edition-${day}`} className="font-semibold">{day === "Earlier editions" ? day : `Edition · ${day}`}</h2><span className="text-xs text-muted">{items.length} products</span></div>
      <ul className="space-y-3">{items.map((l, index) => <LaunchCard key={l.id} launch={l} signedIn={signedIn} rank={index + 1} />)}</ul>
    </section>
  ))}</div>;
}
