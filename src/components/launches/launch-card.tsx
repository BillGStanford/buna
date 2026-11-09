import Link from "next/link";
import { CalendarClock, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StartupLogo } from "@/components/startups/startup-logo";
import { VoteButton } from "./vote-button";
import { formatDate } from "@/lib/format";
import type { LaunchCardData } from "@/lib/launches/queries";

export function LaunchCard({ launch, signedIn }: { launch: LaunchCardData; signedIn: boolean }) {
  const upcoming = launch.status === "scheduled";
  const maker = launch.maker;
  return (
    <li className="group relative flex items-start gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-primary-pale">
      <StartupLogo name={launch.name} src={launch.logo_url ?? launch.startup?.logo_url} size={56} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold leading-snug">
            <Link href={`/launches/${launch.slug}`} data-analytics-event="launch_view" className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline">{launch.name}</Link>
          </h3>
          {launch.is_featured ? <Badge tone="green">Featured</Badge> : null}
          {launch.is_demo ? <Badge tone="warning">Demo</Badge> : null}
          {upcoming ? <Badge tone="warning"><CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />{launch.launch_date ? formatDate(launch.launch_date) : "Soon"}</Badge> : null}
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

export function LaunchList({ launches, signedIn }: { launches: LaunchCardData[]; signedIn: boolean }) {
  return <ul className="space-y-3">{launches.map((l) => <LaunchCard key={l.id} launch={l} signedIn={signedIn} />)}</ul>;
}
