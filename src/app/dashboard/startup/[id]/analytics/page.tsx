import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/illustrations";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { followerCount } from "@/lib/social/queries";
import { getManagedStartup } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Audience intelligence" };
const DAY = 86_400_000;
const fmt = (n: number) => n.toLocaleString();
const pct = (n: number, d: number) => d ? `${Math.round((n / d) * 100)}%` : "—";

type DailyRow = {
  day: string; event_type: string; source: string; country_code: string;
  device_type: string; event_count: number; unique_visitors: number;
};
type VisitorRow = {
  visitor_id: string; first_seen_at: string; last_seen_at: string;
  first_source: string; first_country_code: string | null;
};
type AttributionRow = { campaign: string | null; referrer_domain: string | null; event_type: string };

function BarList({ rows, total, empty }: { rows: { label: string; value: number }[]; total: number; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return <ul className="space-y-3">{rows.slice(0, 7).map((row) => (
    <li key={row.label}>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate">{row.label}</span><span className="shrink-0 tabular-nums text-muted">{fmt(row.value)} <span className="text-xs">({pct(row.value, total)})</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/20"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.value / Math.max(1, total)) * 100)}%` }} /></div>
    </li>
  ))}</ul>;
}

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/analytics`);
  if (!(await getManagedStartup(id, profile.id))) notFound();

  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since90 = new Date(now - 90 * DAY);
  const since56 = new Date(now - 56 * DAY);
  const since30Date = since30.toISOString().slice(0, 10);
  const since90Date = since90.toISOString().slice(0, 10);
  const admin = createAdminClient();
  const supabase = await createClient();

  const [dailyResult, visitorResult, activeVisitorCount, returningVisitorCount, attributionResult, followers, launchesResult, inquiriesResult, investorSavesResult] = await Promise.all([
    admin.from("startup_analytics_daily").select("day,event_type,source,country_code,device_type,event_count,unique_visitors")
      .eq("startup_id", id).gte("day", since90Date).order("day", { ascending: true }),
    admin.from("startup_analytics_visitors").select("visitor_id,first_seen_at,last_seen_at,first_source,first_country_code")
      .eq("startup_id", id).gte("last_seen_at", since90.toISOString()).limit(1000),
    admin.from("startup_analytics_visitors").select("visitor_id", { count: "exact", head: true })
      .eq("startup_id", id).gte("last_seen_at", since30.toISOString()),
    admin.from("startup_analytics_visitors").select("visitor_id", { count: "exact", head: true })
      .eq("startup_id", id).gte("last_seen_at", since30.toISOString()).lt("first_seen_at", since30.toISOString()),
    admin.from("startup_analytics_events").select("campaign,referrer_domain,event_type")
      .eq("startup_id", id).eq("event_type", "page_view").gte("occurred_at", since30.toISOString()).limit(5000),
    followerCount("startup", id),
    supabase.from("launches").select("status,vote_count,comment_count").eq("startup_id", id),
    admin.from("inquiries").select("created_at,status").eq("startup_id", id).gte("created_at", since30.toISOString()),
    admin.from("investor_saved_startups").select("startup_id", { count: "exact", head: true }).eq("startup_id", id),
  ]);

  if (dailyResult.error || visitorResult.error || activeVisitorCount.error || returningVisitorCount.error || attributionResult.error) {
    throw new Error("Audience analytics could not be loaded. Check the 0022 analytics migration and service-role configuration.");
  }
  if (launchesResult.error || inquiriesResult.error || investorSavesResult.error) {
    throw new Error("Some startup activity metrics could not be loaded. Refresh the page or check the analytics database permissions.");
  }

  const daily = (dailyResult.data ?? []) as DailyRow[];
  const visitors = (visitorResult.data ?? []) as VisitorRow[];
  const active30 = activeVisitorCount.count ?? 0;
  const returning = returningVisitorCount.count ?? 0;
  const newVisitors = Math.max(0, active30 - returning);
  const pageRows = daily.filter((r) => r.event_type === "page_view" && r.day >= since30Date);
  const pageViews = pageRows.reduce((n, r) => n + Number(r.event_count), 0);
  const productClicks = daily.filter((r) => r.event_type === "product_click" && r.day >= since30Date).reduce((n, r) => n + Number(r.event_count), 0);
  const websiteClicks = daily.filter((r) => r.event_type === "website_click" && r.day >= since30Date).reduce((n, r) => n + Number(r.event_count), 0);
  const follows = daily.filter((r) => r.event_type === "follow" && r.day >= since30Date).reduce((n, r) => n + Number(r.event_count), 0);
  const inquiries = (inquiriesResult.data ?? []) as { created_at: string; status: string }[];
  const liveLaunches = ((launchesResult.data ?? []) as { status: string; vote_count: number; comment_count: number }[]).filter((l) => l.status === "published");
  const votes = liveLaunches.reduce((n, l) => n + l.vote_count, 0);
  const comments = liveLaunches.reduce((n, l) => n + l.comment_count, 0);
  const unanswered = inquiries.filter((r) => r.status === "new").length;
  const investorSaves = investorSavesResult.count ?? 0;

  const group = (rows: DailyRow[], key: "source" | "country_code" | "device_type") => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const label = row[key] || "unknown";
      map.set(label, (map.get(label) ?? 0) + Number(row.event_count));
    }
    return [...map.entries()].map(([label, value]) => ({ label: label === "ZZ" ? "Unknown / unavailable" : label, value })).sort((a, b) => b.value - a.value);
  };
  const sources = group(pageRows, "source");
  const countries = group(pageRows.filter((r) => r.country_code !== "ZZ"), "country_code");
  const devices = group(pageRows, "device_type");
  const attribution = (attributionResult.data ?? []) as AttributionRow[];
  const countLabels = (values: (string | null)[]) => {
    const counts = new Map<string, number>();
    for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const campaigns = countLabels(attribution.map((r) => r.campaign));
  const referringSites = countLabels(attribution.map((r) => r.referrer_domain));

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(since56.getTime() + i * 7 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    const count = daily.filter((r) => r.event_type === "page_view" && new Date(r.day + "T00:00:00Z") >= start && new Date(r.day + "T00:00:00Z") < end)
      .reduce((n, r) => n + Number(r.event_count), 0);
    return { label: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), count };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  const cohortMap = new Map<string, { visitors: number; returned: number }>();
  for (const v of visitors) {
    const first = new Date(v.first_seen_at);
    if (first.getTime() < since56.getTime()) continue;
    const monday = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const label = monday.toISOString().slice(0, 10);
    const cohort = cohortMap.get(label) ?? { visitors: 0, returned: 0 };
    cohort.visitors += 1;
    if (new Date(v.last_seen_at).getTime() - first.getTime() >= 7 * DAY) cohort.returned += 1;
    cohortMap.set(label, cohort);
  }
  const cohorts = [...cohortMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);

  const stats: [string, number, string][] = [
    ["Unique visitors", active30, "People who visited in the last 30 days"],
    ["Profile views", pageViews, "Recorded page loads in the last 30 days"],
    ["Returning visitors", returning, `${pct(returning, active30)} of active visitors`],
    ["New visitors", newVisitors, "First discovered in the last 30 days"],
    ["New followers", follows, "Attributed follows in the last 30 days"],
    ["Inquiries", inquiries.length, "Messages received in the last 30 days"],
    ["Website clicks", websiteClicks, "Clicks to your main website"],
    ["Investor saves", investorSaves, "All-time aggregate saves by investors"],
  ];
  const hasActivity = active30 + followers + inquiries.length + liveLaunches.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Audience intelligence</h2>
        <p className="text-sm text-muted">Understand who discovers your startup, where they come from, and what they do next. Reporting window: last 30 days, with 90-day audience history.</p>
      </div>

      {!hasActivity ? <EmptyState illustration="startups" title="Your audience story starts here">Once your startup is published and people visit it, Buna will show where they came from, what they explored and whether they returned.</EmptyState> : null}

      <section aria-label="Audience overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value, note]) => <Card key={label}><CardBody><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{fmt(value)}</p><p className="mt-1 text-xs text-muted">{note}</p></CardBody></Card>)}
      </section>

      <Card>
        <CardHeader><h3 className="font-semibold">Profile views over time</h3><p className="mt-1 text-xs text-muted">Weekly totals · last 8 weeks</p></CardHeader>
        <CardBody>
          <div role="img" aria-label={`Profile views per week: ${weeks.map((w) => `${w.label}: ${w.count}`).join(", ")}`} className="flex h-44 items-end gap-2">
            {weeks.map((w) => <div key={w.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs tabular-nums text-muted">{fmt(w.count)}</span>
              <div className="w-full rounded-t bg-primary" style={{ height: `${(w.count / maxWeek) * 100}%`, minHeight: w.count ? 4 : 2, opacity: w.count ? 1 : 0.2 }} />
              <span className="text-[10px] text-muted">{w.label}</span>
            </div>)}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><h3 className="font-semibold">Where your audience comes from</h3><p className="mt-1 text-xs text-muted">Profile views attributed to first-party source data</p></CardHeader><CardBody><BarList rows={sources} total={pageViews} empty="No source data yet. Share your Buna profile to start learning which channels work." /></CardBody></Card>
        <Card><CardHeader><h3 className="font-semibold">Audience geography</h3><p className="mt-1 text-xs text-muted">Country-level location only; unavailable locations are excluded</p></CardHeader><CardBody><BarList rows={countries} total={countries.reduce((n, r) => n + r.value, 0)} empty="Geographic insights will appear as supported location data arrives." /></CardBody></Card>
        <Card><CardHeader><h3 className="font-semibold">Campaigns</h3><p className="mt-1 text-xs text-muted">UTM campaign labels attached to profile visits</p></CardHeader><CardBody><BarList rows={campaigns} total={campaigns.reduce((n, r) => n + r.value, 0)} empty="No tagged campaigns yet. Add UTM campaign parameters to shared profile links." /></CardBody></Card>
        <Card><CardHeader><h3 className="font-semibold">Referring websites</h3><p className="mt-1 text-xs text-muted">Domains that linked visitors to your profile</p></CardHeader><CardBody><BarList rows={referringSites} total={referringSites.reduce((n, r) => n + r.value, 0)} empty="Referring domains will appear when people arrive from external websites." /></CardBody></Card>
        <Card><CardHeader><h3 className="font-semibold">Devices</h3><p className="mt-1 text-xs text-muted">Coarse device category, never a device fingerprint</p></CardHeader><CardBody><BarList rows={devices} total={devices.reduce((n, r) => n + r.value, 0)} empty="No device data yet." /></CardBody></Card>
        <Card><CardHeader><h3 className="font-semibold">What visitors do next</h3><p className="mt-1 text-xs text-muted">Actions after discovering your profile · last 30 days</p></CardHeader><CardBody>
          <ol className="space-y-3">
            {[
              ["Profile visitors", active30],
              ["Viewed profile pages", pageViews],
              ["Clicked a product", productClicks],
              ["Visited your website", websiteClicks],
              ["Followed your startup", follows],
              ["Sent an inquiry", inquiries.length],
            ].map(([label, value], i) => <li key={label} className="flex items-center justify-between gap-3 text-sm"><span>{i + 1}. {label}</span><strong className="tabular-nums">{fmt(Number(value))}</strong></li>)}
          </ol>
          <p className="mt-3 text-xs text-muted">Counts are actions, not necessarily distinct people; one visitor can take several actions.</p>
        </CardBody></Card>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold">Audience retention</h3><p className="mt-1 text-xs text-muted">New visitors who returned at least 7 days after their first recorded visit · 8-week cohorts</p></CardHeader>
        <CardBody>
          {cohorts.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-xs text-muted"><th className="py-2 pr-3 font-medium">First visit week</th><th className="py-2 pr-3 font-medium">New visitors</th><th className="py-2 pr-3 font-medium">Returned after 7 days</th><th className="py-2 font-medium">Retention</th></tr></thead><tbody>{cohorts.map(([week, cohort]) => <tr key={week} className="border-b border-line last:border-0"><td className="py-3 pr-3">{week}</td><td className="py-3 pr-3 tabular-nums">{fmt(cohort.visitors)}</td><td className="py-3 pr-3 tabular-nums">{fmt(cohort.returned)}</td><td className="py-3 tabular-nums">{pct(cohort.returned, cohort.visitors)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted">Retention cohorts will appear after visitors have had time to return.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold">Existing Buna activity</h3><p className="mt-1 text-xs text-muted">Engagement already recorded by the platform</p></CardHeader>
        <CardBody><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-sm text-muted">Followers</p><p className="mt-1 text-2xl font-bold tabular-nums">{fmt(followers)}</p></div><div><p className="text-sm text-muted">Live launches</p><p className="mt-1 text-2xl font-bold tabular-nums">{fmt(liveLaunches.length)}</p></div><div><p className="text-sm text-muted">Launch votes / comments</p><p className="mt-1 text-2xl font-bold tabular-nums">{fmt(votes)} / {fmt(comments)}</p></div><div><p className="text-sm text-muted">Unanswered inquiries</p><p className="mt-1 text-2xl font-bold tabular-nums">{fmt(unanswered)}</p></div></div></CardBody>
      </Card>

      <p className="text-xs text-muted">Privacy by design: Buna records random first-party visitor and session IDs, country-level geography, coarse device type and referring domain. It does not store IP addresses, full referrer URLs, emails, or browser fingerprints. Visitors who block browser storage may not be counted. Investor saves are aggregate interest signals; individual investor identities are not exposed in this report.</p>
    </div>
  );
}
