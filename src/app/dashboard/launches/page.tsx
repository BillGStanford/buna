import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/illustrations";
import { StartupLogo } from "@/components/startups/startup-logo";
import { requireProfile } from "@/lib/auth/session";
import { LAUNCH_STATUS_LABELS } from "@/lib/launches/constants";
import { listMyLaunches } from "@/lib/launches/queries";

export const metadata: Metadata = { title: "My launches" };

export default async function MyLaunchesPage() {
  const profile = await requireProfile("/dashboard/launches");
  const launches = await listMyLaunches(profile.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">My launches</h1><p className="mt-1 text-sm text-muted">Products you’ve submitted to Buna.</p><Link href="/dashboard/launches/momentum" className="mt-2 inline-flex text-sm font-medium text-primary-deep hover:underline">Open Launch Momentum →</Link></div>
        {launches.length > 0 && !profile.is_suspended ? <Link href="/launches/submit" className={buttonStyles("primary", "md")}><Plus className="h-4 w-4" aria-hidden="true" />New launch</Link> : null}
      </div>
      {launches.length === 0 ? (
        <EmptyState illustration="launches" title="You haven’t submitted a launch yet" action={profile.is_suspended ? undefined : <Link href="/launches/submit" className={buttonStyles("primary", "md")}>Submit a launch</Link>}>
          Show a product to the community. It stays private until it’s reviewed and approved.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {launches.map((l) => {
            const st = LAUNCH_STATUS_LABELS[l.status] ?? { label: l.status, tone: "neutral" as const, help: "" };
            return (
              <li key={l.id}>
                <Card className="flex flex-wrap items-center gap-4 p-4">
                  <StartupLogo name={l.name} src={l.logo_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{l.name}</h2><Badge tone={st.tone}>{st.label}</Badge></div>
                    <p className="mt-0.5 truncate text-sm text-muted">{l.tagline}</p>
                    {l.status === "rejected" && l.moderation_note ? <p className="mt-1 text-sm text-danger">Moderator note: {l.moderation_note}</p> : null}
                    {l.status === "published" ? <p className="mt-1 text-xs text-muted"><span className="tabular-nums">{l.vote_count}</span> votes · <span className="tabular-nums">{l.comment_count}</span> comments</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/launches/${l.slug}`} className={buttonStyles("ghost", "sm")}>{l.status === "published" ? "View" : "Preview"}</Link>
                    <Link href={`/dashboard/launches/${l.id}`} className={buttonStyles("secondary", "sm")}>Manage</Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
