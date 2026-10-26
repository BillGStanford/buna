import Link from "next/link";
import { CalendarClock, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SaveOpportunityButton } from "./save-button";
import { formatDate } from "@/lib/format";
import { countryName } from "@/lib/geo";
import { categoryLabel } from "@/lib/opportunities/constants";
import { deadlineState, describeDeadline } from "@/lib/opportunities/params";
import type { OpportunityCardData } from "@/lib/opportunities/queries";

export function OpportunityCard({ o, signedIn, returnTo }: { o: OpportunityCardData; signedIn: boolean; returnTo: string }) {
  const state = deadlineState(o.status, o.deadline);
  const where = o.countries.length === 0 ? "All of Africa" : o.countries.slice(0, 3).map((c) => countryName(c) ?? c).join(", ") + (o.countries.length > 3 ? ` +${o.countries.length - 3}` : "");
  return (
    <li className="group relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-primary-pale sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">{categoryLabel(o.category)}</Badge>
          {o.is_demo ? <Badge tone="warning">Demo</Badge> : null}
          <Badge tone={state.kind === "closed" ? "danger" : state.kind === "open" && state.daysLeft <= 7 ? "warning" : "neutral"}>
            <CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />{describeDeadline(state)}
          </Badge>
        </div>
        <h3 className="mt-2 text-base font-semibold leading-snug">
          <Link href={`/opportunities/${o.slug}`} className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline">{o.title}</Link>
        </h3>
        <p className="text-sm text-muted">{o.organization}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" aria-hidden="true" />{where}</span>
          {o.deadline ? <span>Deadline <time dateTime={o.deadline}>{formatDate(o.deadline)}</time></span> : null}
        </p>
      </div>
      <div className="relative z-10"><SaveOpportunityButton opportunityId={o.id} title={o.title} saved={o.saved} signedIn={signedIn} loginHref={`/login?next=${encodeURIComponent(returnTo)}`} returnTo={returnTo} /></div>
    </li>
  );
}

export function OpportunityList({ items, signedIn, returnTo }: { items: OpportunityCardData[]; signedIn: boolean; returnTo: string }) {
  return <ul className="space-y-3">{items.map((o) => <OpportunityCard key={o.id} o={o} signedIn={signedIn} returnTo={returnTo} />)}</ul>;
}
