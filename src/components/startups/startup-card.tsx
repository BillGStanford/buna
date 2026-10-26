import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StartupLogo } from "./startup-logo";
import { countryName } from "@/lib/geo";
import { stageLabel } from "@/lib/startups/constants";
import type { StartupCardData } from "@/lib/startups/queries";

export function StartupCard({ startup }: { startup: StartupCardData }) {
  const location = [startup.city, countryName(startup.country)].filter(Boolean).join(", ");
  const stage = stageLabel(startup.stage);
  return (
    <li className="group relative flex gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-primary-pale">
      <StartupLogo name={startup.name} src={startup.logo_url} size={56} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold leading-snug">
            <Link href={`/startups/${startup.slug}`} className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline">
              {startup.name}
            </Link>
          </h3>
          {startup.verification_status === "verified" ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-deep" title="Verified by Buna">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Verified by Buna</span>
            </span>
          ) : null}
          {startup.is_featured ? <Badge tone="green">Featured</Badge> : null}
          {startup.is_demo ? <Badge tone="warning">Demo</Badge> : null}
        </div>
        {startup.tagline ? <p className="mt-1 line-clamp-2 text-sm text-muted">{startup.tagline}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {startup.category ? <Badge>{startup.category.name}</Badge> : null}
          {stage ? <span>{stage}</span> : null}
          {location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{location}</span> : null}
        </div>
      </div>
    </li>
  );
}

export function StartupGrid({ startups }: { startups: StartupCardData[] }) {
  return <ul className="grid gap-3 lg:grid-cols-2">{startups.map((s) => <StartupCard key={s.id} startup={s} />)}</ul>;
}
