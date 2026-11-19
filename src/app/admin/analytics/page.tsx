import {requireAdmin} from "@/lib/auth/session";
import {createAdminClient} from "@/lib/supabase/admin";
export const dynamic="force-dynamic";
export default async function PlatformAnalyticsPage(){
 await requireAdmin();const db=createAdminClient(),since=new Date(Date.now()-30*86400000).toISOString();
 const [agg,vis]=await Promise.all([
  db.from("platform_analytics_daily").select("event_type,event_count,source").gte("day",since.slice(0,10)),
  db.from("platform_analytics_visitors").select("visitor_id",{count:"exact",head:true}).gte("last_seen_at",since)
 ]);
 const groups=agg.data??[],total=(type:string)=>groups.filter(x=>x.event_type===type).reduce((n,x)=>n+Number(x.event_count),0);
 const views=total("page_view"),signups=total("signup_created"),verified=total("email_verified"),onboarded=total("onboarding_completed"),launchViews=total("launch_view"),submitted=total("launch_submitted"),votes=total("launch_vote"),published=total("launch_published"),unique=vis.count??0;
 const sources=new Map<string,number>();for(const x of groups)if(x.event_type==="page_view")sources.set(x.source,(sources.get(x.source)||0)+Number(x.event_count));
 const cards=[["Page views",views],["Unique visitors",unique],["New signups",signups],["Email verified",verified],["Onboarding completed",onboarded],["Launch views",launchViews],["Launches submitted",submitted],["Launch votes",votes],["Launches published",published]];
 const pct=(a:number,b:number)=>b?(a/b*100).toFixed(1)+"%":"0.0%";
 return <div className="space-y-7"><header><h1 className="text-2xl font-bold">Platform analytics</h1><p className="mt-1 text-sm text-muted">Buna acquisition and activation · trailing 30 days · first-party analytics.</p></header>
 <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([k,v])=><article key={String(k)} className="rounded-xl border border-line bg-surface p-4"><p className="text-sm text-muted">{k}</p><p className="mt-2 text-3xl font-bold tabular-nums">{Number(v).toLocaleString()}</p></article>)}</section>
 <section className="grid gap-3 sm:grid-cols-3">{[["Visitor → signup",pct(signups,unique)],["Signup → verified",pct(verified,signups)],["Verified → onboarded",pct(onboarded,verified)]].map(([k,v])=><article key={k} className="rounded-xl border border-line p-4"><p className="text-sm text-muted">{k}</p><p className="mt-2 text-2xl font-bold">{v}</p></article>)}</section>
 <section className="rounded-xl border border-line p-4"><h2 className="font-semibold">Acquisition sources · page views</h2>{[...sources].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=><div key={k} className="flex justify-between border-b border-line py-2 text-sm"><span>{k}</span><strong>{v.toLocaleString()}</strong></div>)}{!sources.size&&<p className="mt-3 text-sm text-muted">No traffic recorded yet.</p>}</section>
 <p className="text-xs text-muted">All event totals use database-maintained daily aggregates. Unique visitors are distinct first-party visitor IDs active in the 30-day window. Historical analytics begin after deployment. Visitors who opt out or block analytics are excluded.</p></div>
}