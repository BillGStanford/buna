import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/illustrations";
import { StartupLogo } from "@/components/startups/startup-logo";
import { requireProfile } from "@/lib/auth/session";
import { STATUS_LABELS } from "@/lib/startups/constants";
import { listMyStartups } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "My startups" };

export default async function MyStartupsPage() {
  const profile = await requireProfile("/dashboard/startup");
  const startups = await listMyStartups(profile.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My startups</h1>
          <p className="mt-1 text-sm text-muted">Create and manage your startup profiles.</p>
        </div>
        {startups.length > 0 && !profile.is_suspended ? <Link href="/dashboard/startup/new" className={buttonStyles("primary", "md")}><Plus className="h-4 w-4" aria-hidden="true" />New startup</Link> : null}
      </div>

      {startups.length === 0 ? (
        <EmptyState illustration="startups" title="You haven’t added a startup yet" action={profile.is_suspended ? undefined : <Link href="/dashboard/startup/new" className={buttonStyles("primary", "md")}>Add your startup</Link>}>
          Create a profile in a few minutes. It stays private until you publish it.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {startups.map((s) => {
            const st = STATUS_LABELS[s.status] ?? { label: s.status, tone: "neutral" as const };
            return (
              <li key={s.id}>
                <Card className="flex flex-wrap items-center gap-4 p-4">
                  <StartupLogo name={s.name} src={s.logo_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{s.name}</h2><Badge tone={st.tone}>{st.label}</Badge>
                      {s.is_demo ? <Badge tone="warning">Demo</Badge> : null}
                    </div>
                    {s.tagline ? <p className="mt-0.5 truncate text-sm text-muted">{s.tagline}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/startups/${s.slug}`} className={buttonStyles("ghost", "sm")}>{s.status === "published" ? "View" : "Preview"}</Link>
                    <Link href={`/dashboard/startup/${s.id}`} className={buttonStyles("secondary", "sm")}>Manage</Link>
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
