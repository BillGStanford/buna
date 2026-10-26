import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { LAUNCH_STATUS_LABELS } from "@/lib/launches/constants";
import { listMyLaunches } from "@/lib/launches/queries";
import { profileCompletion } from "@/lib/profile-completion";
import { listMyStartups } from "@/lib/startups/queries";
import { STATUS_LABELS } from "@/lib/startups/constants";
import { createClient } from "@/lib/supabase/server";
import { unreadInquiryCount } from "@/lib/inquiries/queries";

export const metadata: Metadata = { title: "Dashboard" };

async function count(table: string, column: string, userId: string) {
  const supabase = await createClient();
  const { count: n } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, userId);
  return n ?? 0;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile("/dashboard");
  const user = await requireUser("/dashboard");
  const { notice } = await searchParams;
  const { percent, items } = profileCompletion(profile);
  const firstName = profile.display_name.split(" ")[0];
  const finishHref = profile.onboarding_completed_at ? "/dashboard/profile" : "/onboarding";
  const [startups, launches, unreadInquiries, saved, following] = await Promise.all([
    listMyStartups(profile.id), listMyLaunches(profile.id), unreadInquiryCount(), count("saved_opportunities", "user_id", profile.id), count("follows", "follower_id", profile.id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
      {notice === "password_updated" ? <Alert tone="success">Your password was updated.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Startups", value: startups.length, href: "/dashboard/startup" },
          { label: "Launches", value: launches.length, href: "/dashboard/launches" },
          { label: "Unread inquiries", value: unreadInquiries, href: "/dashboard/inquiries" },
          { label: "Saved opportunities", value: saved, href: "/dashboard/saved" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-line bg-surface p-4 no-underline transition-colors hover:border-primary/40 hover:bg-primary-pale">
            <p className="text-sm text-muted">{s.label}</p><p className="mt-1 text-3xl font-bold tabular-nums text-ink">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between gap-3"><h2 className="font-semibold">Your startups</h2><Link href="/dashboard/startup" className="text-sm font-medium">Manage</Link></CardHeader>
          <CardBody>
            {startups.length === 0 ? <div className="space-y-3"><p className="text-sm text-muted">You haven’t added a startup yet.</p><Link href="/dashboard/startup/new" className={buttonStyles("primary", "sm")}>Add your startup</Link></div> : (
              <ul className="space-y-2">{startups.slice(0, 4).map((s) => { const st = STATUS_LABELS[s.status] ?? { label: s.status, tone: "neutral" as const }; return <li key={s.id} className="flex items-center justify-between gap-2 text-sm"><Link href={`/dashboard/startup/${s.id}`} className="truncate font-medium">{s.name}</Link><Badge tone={st.tone}>{st.label}</Badge></li>; })}</ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-3"><h2 className="font-semibold">Recent launches</h2><Link href="/dashboard/launches" className="text-sm font-medium">Manage</Link></CardHeader>
          <CardBody>
            {launches.length === 0 ? <div className="space-y-3"><p className="text-sm text-muted">No launches yet.</p><Link href="/launches/submit" className={buttonStyles("secondary", "sm")}>Submit a launch</Link></div> : (
              <ul className="space-y-2">{launches.slice(0, 4).map((l) => { const st = LAUNCH_STATUS_LABELS[l.status] ?? { label: l.status, tone: "neutral" as const }; return <li key={l.id} className="flex items-center justify-between gap-2 text-sm"><Link href={`/dashboard/launches/${l.id}`} className="truncate font-medium">{l.name}</Link><span className="flex items-center gap-2"><span className="text-xs tabular-nums text-muted">{l.vote_count} votes</span><Badge tone={st.tone}>{st.label}</Badge></span></li>; })}</ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Profile completion</h2><p className="text-sm text-muted">{percent === 100 ? "Your profile is complete." : "A complete profile makes you easier to find and trust."}</p></div>
          <span className="text-2xl font-bold tabular-nums text-primary-deep">{percent}%</span>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-primary-mint" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                {item.done ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : <Circle className="h-4 w-4 text-muted" aria-hidden="true" />}
                <span className={item.done ? "text-muted line-through" : "text-ink"}>{item.label}</span><span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
              </li>
            ))}
          </ul>
          {percent < 100 ? <Link href={finishHref} className={buttonStyles("primary", "md")}>Finish your profile</Link> : null}
        </CardBody>
      </Card>

      <p className="text-sm text-muted">Signed in as {user.email} · following <span className="tabular-nums">{following}</span> · <Link href="/dashboard/settings" className="font-medium">Account settings</Link></p>
    </div>
  );
}
