import Link from "next/link";
import { ArrowUpRight, CalendarClock, Globe2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SaveOpportunityButton } from "./save-button";
import { formatDate } from "@/lib/format";
import { countryName, countryFlagEmoji } from "@/lib/geo";
import { categoryLabel } from "@/lib/opportunities/constants";
import { deadlineState, describeDeadline } from "@/lib/opportunities/params";
import type { OpportunityCardData } from "@/lib/opportunities/queries";

export function OpportunityCard({ o, signedIn, returnTo }: { o: OpportunityCardData; signedIn: boolean; returnTo: string }) {
  const state = deadlineState(o.status, o.deadline);
  const where = o.countries.length === 0 ? "Open to all of Africa" : o.countries.slice(0, 3).map((c) => `${countryFlagEmoji(c)} ${countryName(c) ?? c}`).join(", ") + (o.countries.length > 3 ? ` +${o.countries.length - 3}` : "");
  const deadlineTone = state.kind === "closed" ? "danger" : state.kind === "open" && state.daysLeft <= 7 ? "warning" : "neutral";
  return (
    <li className="group rounded-xl border border-line bg-surface p-5 shadow-[0_1px_3px_rgba(23,43,36,0.04)] transition-all hover:border-primary/35 hover:shadow-[0_8px_24px_rgba(23,43,36,0.07)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">{categoryLabel(o.category)}</Badge>
            {o.is_demo ? <Badge tone="warning">Demo listing</Badge> : null}
            <Badge tone={deadlineTone}><CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />{describeDeadline(state)}</Badge>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">
            <Link href={`/opportunities/${o.slug}`} className="text-ink no-underline hover:text-primary-deep hover:underline">{o.title}</Link>
          </h3>
          <p className="mt-1 text-sm text-muted">{o.organization}</p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex min-w-0 items-start gap-2 text-muted"><Globe2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><span className="block text-xs text-muted">Eligible location</span><span className="mt-0.5 block font-medium text-ink">{where}</span></span></div>
            <div className="flex min-w-0 items-start gap-2 text-muted"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><span className="block text-xs text-muted">Application deadline</span><span className="mt-0.5 block font-medium text-ink">{o.deadline ? formatDate(o.deadline) : "No fixed deadline"}</span></span></div>
          </div>
          {o.tags.length > 0 ? <div className="mt-4 flex flex-wrap gap-1.5">{o.tags.slice(0, 4).map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-line bg-primary-pale px-2.5 py-1 text-xs text-muted"><Tag className="h-3 w-3" aria-hidden="true" />{tag}</span>)}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <div className="sm:order-2"><SaveOpportunityButton opportunityId={o.id} title={o.title} saved={o.saved} signedIn={signedIn} loginHref={`/login?next=${encodeURIComponent(returnTo)}`} returnTo={returnTo} /></div>
          <Link href={`/opportunities/${o.slug}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:order-1">
            View details <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </li>
  );
}

export function OpportunityList({ items, signedIn, returnTo }: { items: OpportunityCardData[]; signedIn: boolean; returnTo: string }) {
  return <ul className="space-y-4">{items.map((o) => <OpportunityCard key={o.id} o={o} signedIn={signedIn} returnTo={returnTo} />)}</ul>;
}
