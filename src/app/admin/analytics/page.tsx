import {requireAdmin} from "@/lib/auth/session";
import {createAdminClient} from "@/lib/supabase/admin";
export const dynamic="force-dynamic";
export default async function PlatformAnalyticsPage(){
 await requireAdmin();const db=createAdminClient(),since=new Date(Date.now()-30*86400000).toISOString();
 const [ev,agg,launches]=await Promise.all([
 db.from("platform_analytics_events").select("event_type,visitor_id").gte("occurred_at",since).limit(20000),
 db.from("platform_analytics_daily").select("day,event_type,event_count,unique_visitors,source").gte("day",since.slice(0,10)).order("day",{ascending:true}),
 db.from("platform_analytics_events").select("id",{count:"exact",head:true}).eq("event_type","launch_published").gte("occurred_at",since)]);
 const rows=ev.data??[],count=(t:string)=>rows.filter(x=>x.event_type===t).length,views=count("page_view"),signups=count("signup_created"),verified=count("email_verified"),onboarded=count("onboarding_completed"),launchViews=count("launch_view"),votes=count("launch_vote");
 const unique=new Set(rows.filter(x=>x.event_type==="page_view"&&x.visitor_id).map(x=>x.visitor_id)).size;
 const sources=new Map<string,number>();for(const x of agg.data??[])if(x.event_type==="page_view")sources.set(x.source,(sources.get(x.source)||0)+Number(x.event_count));
 const cards=[["Page views",views],["Unique visitors",unique],["New signups",signups],["Email verified",verified],["Onboarding completed",onboarded],["Launch views",launchViews],["Launch votes",votes],["Launches published",launches.count??0]];
 const pct=(a:number,b:number)=>b?(a/b*100).toFixed(1)+"%":"0.0%";
 return <div className="space-y-7"><header><h1 className="text-2xl font-bold">Platform analytics</h1><p className="mt-1 text-sm text-muted">Buna acquisition and activation · trailing 30 days · first-party analytics.</p></header>
 <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([k,v])=><article key={String(k)} className="rounded-xl border border-line bg-surface p-4"><p className="text-sm text-muted">{k}</p><p className="mt-2 text-3xl font-bold tabular-nums">{Number(v).toLocaleString()}</p></article>)}</section>
 <section className="grid gap-3 sm:grid-cols-3">{[["Visitor → signup",pct(signups,unique)],["Signup → verified",pct(verified,signups)],["Verified → onboarded",pct(onboarded,verified)]].map(([k,v])=><article key={k} className="rounded-xl border border-line p-4"><p className="text-sm text-muted">{k}</p><p className="mt-2 text-2xl font-bold">{v}</p></article>)}</section>
 <section className="rounded-xl border border-line p-4"><h2 className="font-semibold">Acquisition sources · page views</h2>{[...sources].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=><div key={k} className="flex justify-between border-b border-line py-2 text-sm"><span>{k}</span><strong>{v.toLocaleString()}</strong></div>)}{!sources.size&&<p className="mt-3 text-sm text-muted">No traffic recorded yet.</p>}</section>
 <p className="text-xs text-muted">Raw event metrics are capped at 20,000 events in the 30-day window. Unique visitor cards use deduplicated page-view IDs in that window. Historical analytics begin after deployment. Opt-outs and blocked requests are excluded.</p></div>
}