import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/illustrations";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { followerCount } from "@/lib/social/queries";
import { getManagedStartup } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Analytics" };
const WEEK = 7 * 86_400_000;

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/analytics`);
  if (!(await getManagedStartup(id, profile.id))) notFound();
  const supabase = await createClient();
  const since = new Date(Date.now() - 8 * WEEK).toISOString();
  const [followers, launches, inquiries] = await Promise.all([
    followerCount("startup", id),
    supabase.from("launches").select("status, vote_count, comment_count").eq("startup_id", id),
    supabase.from("inquiries").select("created_at, status").eq("startup_id", id).gte("created_at", since),
  ]);
  const ls = (launches.data ?? []) as { status: string; vote_count: number; comment_count: number }[];
  const live = ls.filter((l) => l.status === "published");
  const votes = live.reduce((n, l) => n + l.vote_count, 0);
  const comments = live.reduce((n, l) => n + l.comment_count, 0);
  const inq = (inquiries.data ?? []) as { created_at: string; status: string }[];
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = Date.now() - (7 - i) * WEEK;
    return { label: new Date(start).toISOString().slice(5, 10), count: inq.filter((r) => { const t = new Date(r.created_at).getTime(); return t > start - WEEK && t <= start; }).length };
  });
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const stats: [string, number][] = [["Followers", followers], ["Live launches", live.length], ["Votes on launches", votes], ["Comments on launches", comments], ["Inquiries (8 weeks)", inq.length], ["Unanswered inquiries", inq.filter((r) => r.status === "new").length]];
  const empty = followers + ls.length + inq.length === 0;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Everything here is counted from real activity on Buna. We don’t track page views or visitors, so there’s no traffic chart.</p>
      {empty ? <EmptyState illustration="startups" title="No activity yet">Publish your startup, launch a product and share your profile link — followers, votes and messages will show up here.</EmptyState> : null}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value]) => <Card key={label}><CardBody><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-3xl font-bold tabular-nums">{value}</dd></CardBody></Card>)}
      </dl>
      <Card>
        <CardHeader><h2 className="font-semibold">Inquiries per week</h2></CardHeader>
        <CardBody>
          <div role="img" aria-label={`Inquiries per week for the last 8 weeks: ${weeks.map((w) => `${w.label}: ${w.count}`).join(", ")}`} className="flex h-40 items-end gap-2">
            {weeks.map((w) => (
              <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs tabular-nums text-muted">{w.count}</span>
                <div className="w-full rounded-t bg-primary" style={{ height: `${(w.count / max) * 100}%`, minHeight: w.count > 0 ? 4 : 2, opacity: w.count > 0 ? 1 : 0.25 }} />
                <span className="text-[10px] tabular-nums text-muted">{w.label}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
