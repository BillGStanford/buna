import Link from "next/link";
import { BadgeCheck, ExternalLink, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { countryName } from "@/lib/geo";
import { OPEN_TO } from "@/lib/people/params";
import { stageLabel } from "@/lib/startups/constants";
import type { FounderCard as FounderCardData, InvestorData } from "@/lib/people/queries";

export function FounderCard({ f }: { f: FounderCardData }) {
  const where = [f.city, countryName(f.country)].filter(Boolean).join(", ");
  return (
    <li className="group relative flex gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-primary-pale">
      <Avatar name={f.display_name} src={f.avatar_url} size={56} />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold leading-snug"><Link href={`/founders/${f.username}`} className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline">{f.display_name || `@${f.username}`}</Link></h2>
        {f.headline ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{f.headline}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {where ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{where}</span> : null}
          {f.startups[0] ? <span>{f.startups[0].public_title ? `${f.startups[0].public_title} at ` : ""}<strong className="font-medium text-ink">{f.startups[0].name}</strong></span> : null}
        </div>
        {f.open_to.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{f.open_to.map((o) => <Badge key={o} tone="green">{OPEN_TO.find((x) => x.value === o)?.label ?? o}</Badge>)}</div> : null}
      </div>
    </li>
  );
}

export function InvestorCard({ i }: { i: InvestorData }) {
  return (
    <li className="group relative rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-primary-pale">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold leading-snug"><Link href={`/investors/${i.slug}`} className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline">{i.name}</Link></h2>
        {i.verification_status === "verified" ? <Badge tone="green"><BadgeCheck className="mr-1 h-3 w-3" aria-hidden="true" />Verified</Badge> : <Badge>Unverified</Badge>}
        {i.is_demo ? <Badge tone="warning">Demo</Badge> : null}
      </div>
      {i.description ? <p className="mt-1 line-clamp-2 text-sm text-muted">{i.description}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {i.country ? <Badge>{countryName(i.country) ?? i.country}</Badge> : null}
        {i.stages.slice(0, 3).map((s) => <Badge key={s} tone="green">{stageLabel(s) ?? s}</Badge>)}
        {i.sectors.slice(0, 3).map((s) => <Badge key={s}>{s.replace(/-/g, " ")}</Badge>)}
      </div>
    </li>
  );
}

export function ExternalLinkText({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1">{children}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>;
}
