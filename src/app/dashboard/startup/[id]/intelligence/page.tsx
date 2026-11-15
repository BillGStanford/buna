import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getManagedStartup } from "@/lib/startups/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveStartupMetricAction, saveFundingRoundAction, addCompanyClaimAction, dismissEnrichmentNudgeAction, saveFounderHistoryAction } from "@/app/dashboard/startup/intelligence-actions";

export const metadata: Metadata = { title: "Company intelligence", robots: { index: false } };
const metricLabels: Record<string,string> = { revenue:"Revenue", customers:"Customers", active_users:"Active users", employees:"Employees", revenue_growth_pct:"Revenue growth (%)", customer_growth_pct:"Customer growth (%)" };
export default async function StartupIntelligencePage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params; const profile=await requireProfile("/dashboard/startup/"+id+"/intelligence");
 const managed=await getManagedStartup(id,profile.id); if(!managed) notFound();
 const supabase=await createClient();
 const [metrics,rounds,claims,nudges,founderHistory]=await Promise.all([
  supabase.from("startup_metrics").select("id,metric_key,value,currency,period_start,period_end,visibility,source_status,created_at").eq("startup_id",id).order("period_end",{ascending:false,nullsFirst:false}).limit(100),
  supabase.from("startup_funding_rounds").select("id,round_name,amount,currency,announced_on,lead_investor,visibility,source_status").eq("startup_id",id).order("announced_on",{ascending:false,nullsFirst:false}),
  supabase.from("startup_data_claims").select("id,claim_type,claim_text,source_status,visibility,created_at").eq("startup_id",id).order("created_at",{ascending:false}).limit(50),
  supabase.from("startup_enrichment_nudges").select("id,nudge_key,delivered_at").eq("startup_id",id).eq("user_id",profile.id).is("dismissed_at",null).order("delivered_at",{ascending:false}).limit(5),
  supabase.from("founder_company_history").select("id,company_name,role_title,started_on,ended_on,description,visibility").eq("founder_id",profile.id).order("started_on",{ascending:false,nullsFirst:false})
 ]);
 if(metrics.error) throw metrics.error; if(rounds.error) throw rounds.error; if(claims.error) throw claims.error; if(founderHistory.error) throw founderHistory.error;
 return <div className="space-y-6">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm"><Link href={"/dashboard/startup/"+id} className="underline">← Startup profile</Link></p><h1 className="mt-2 text-2xl font-bold">Company intelligence</h1><p className="mt-1 max-w-2xl text-sm text-muted">Add operating metrics and company history over time. Everything on this page is optional. You can keep information private and come back whenever you are ready.</p></div><Badge tone="green">Recommended · never required</Badge></div>
  {nudges.data?.length ? <Card><CardHeader><h2 className="font-semibold">A next step for your company</h2></CardHeader><CardBody className="space-y-3">{nudges.data.map(n=><div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-3"><div><p className="font-medium">{n.nudge_key==="first_metric"?"Add another reporting period":"Complete another useful company detail"}</p><p className="text-sm text-muted">This can help investors understand your progress. It is optional and will not affect your listing.</p></div><form action={dismissEnrichmentNudgeAction}><input type="hidden" name="startupId" value={id}/><input type="hidden" name="nudgeId" value={n.id}/><button className="text-sm underline">Dismiss</button></form></div>)}</CardBody></Card>:null}
  <Card><CardHeader><h2 className="font-semibold">Operating metrics</h2><p className="text-sm text-muted">Report a figure for a period. You can add historical periods as your business grows.</p></CardHeader><CardBody className="space-y-4">
   <form action={saveStartupMetricAction} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="startupId" value={id}/>
    <label className="text-sm">Metric<select name="metricKey" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2">{Object.entries(metricLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label className="text-sm">Value<input name="value" type="number" step="any" required className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" placeholder="e.g. 125000"/></label>
    <label className="text-sm">Currency (revenue only)<input name="currency" defaultValue="USD" maxLength={3} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Visibility<select name="visibility" defaultValue="investors" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="private">Only my company team</option><option value="investors">Approved investors</option><option value="public">Public profile</option></select></label>
    <label className="text-sm">Period starts<input name="periodStart" type="date" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Period ends<input name="periodEnd" type="date" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm sm:col-span-2">Context (optional)<textarea name="notes" maxLength={1000} rows={2} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" placeholder="Explain the reporting period or how this figure is calculated."/></label>
    <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Add metric</SubmitButton></div>
   </form>
   {metrics.data?.length?<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left"><th className="py-2">Metric</th><th>Value</th><th>Period</th><th>Visibility</th><th>Source</th></tr></thead><tbody>{metrics.data.map(m=><tr key={m.id} className="border-b border-line"><td className="py-2">{metricLabels[m.metric_key]??m.metric_key}</td><td>{Number(m.value).toLocaleString()} {m.metric_key==="revenue"?(m.currency??""):(m.metric_key.endsWith("_pct")?"%":"")}</td><td>{m.period_start||m.period_end?(m.period_start??"—")+" – "+(m.period_end??"—"):"Not specified"}</td><td>{m.visibility}</td><td><Badge>{m.source_status.replace("_"," ")}</Badge></td></tr>)}</tbody></table></div>:<p className="text-sm text-muted">No metrics yet. That is completely fine—you can add them later.</p>}
  </CardBody></Card>
  <Card><CardHeader><h2 className="font-semibold">Funding history</h2><p className="text-sm text-muted">Record previous rounds separately from your current fundraising target.</p></CardHeader><CardBody className="space-y-4">
   <form action={saveFundingRoundAction} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="startupId" value={id}/>
    <label className="text-sm">Round name<input name="roundName" required minLength={2} maxLength={80} placeholder="Pre-seed, Seed, Grant…" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Amount (optional)<input name="amount" type="number" min="0" step="any" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Currency<input name="currency" defaultValue="USD" maxLength={3} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Date announced<input name="announcedOn" type="date" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Lead investor<input name="leadInvestor" maxLength={160} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Visibility<select name="visibility" defaultValue="investors" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="private">Only my company team</option><option value="investors">Approved investors</option><option value="public">Public profile</option></select></label>
    <label className="text-sm sm:col-span-2">Public announcement URL (optional)<input name="sourceUrl" type="url" placeholder="https://" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Add funding round</SubmitButton></div>
   </form>
   {rounds.data?.length?<ul className="divide-y divide-line">{rounds.data.map(r=><li key={r.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{r.round_name}</p><Badge>{r.source_status.replace("_"," ")}</Badge></div><p className="text-sm text-muted">{r.amount===null?"Amount not disclosed":Number(r.amount).toLocaleString()+" "+(r.currency??"")} · {r.announced_on??"Date not disclosed"} · {r.visibility}</p>{r.lead_investor?<p className="text-sm">Lead: {r.lead_investor}</p>:null}</li>)}</ul>:<p className="text-sm text-muted">No historical rounds recorded yet.</p>}
  </CardBody></Card>
  <Card><CardHeader><h2 className="font-semibold">Founder experience (optional)</h2><p className="text-sm text-muted">Share previous roles or companies if you want. Choose whether this information is public, available to approved investors, or private.</p></CardHeader><CardBody className="space-y-4">
   <form action={saveFounderHistoryAction} className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Company or organization<input name="companyName" required minLength={2} maxLength={120} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Your role<input name="roleTitle" required minLength={2} maxLength={100} placeholder="Founder, engineer, product lead…" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Started<input name="startedOn" type="date" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Ended<input name="endedOn" type="date" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm sm:col-span-2">What you worked on (optional)<textarea name="description" maxLength={1000} rows={2} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Visibility<select name="visibility" defaultValue="private" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="private">Private</option><option value="investors">Approved investors</option><option value="public">Public</option></select></label>
    <div className="flex items-end"><SubmitButton pendingLabel="Saving…">Add experience</SubmitButton></div>
   </form>
   {founderHistory.data?.length?<ul className="divide-y divide-line">{founderHistory.data.map(h=><li key={h.id} className="py-3"><p className="font-medium">{h.role_title} · {h.company_name}</p><p className="text-xs text-muted">{h.started_on??"Start not specified"} – {h.ended_on??"Present"} · {h.visibility}</p>{h.description?<p className="mt-1 text-sm">{h.description}</p>:null}</li>)}</ul>:<p className="text-sm text-muted">No previous experience added. You can leave this blank.</p>}
  </CardBody></Card>
  <Card><CardHeader><h2 className="font-semibold">Company information and evidence</h2><p className="text-sm text-muted">Add context that helps others understand your business. Submissions are founder-reported until reviewed.</p></CardHeader><CardBody className="space-y-4">
   <form action={addCompanyClaimAction} className="grid gap-3"><input type="hidden" name="startupId" value={id}/>
    <label className="text-sm">Information type<select name="claimType" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2">{[["founding_date","Founding date"],["revenue","Revenue"],["customers","Customers"],["growth","Growth"],["funding","Funding"],["market_presence","Market presence"],["other","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label className="text-sm">Your information<textarea name="claimText" required minLength={2} maxLength={2000} rows={3} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Supporting source URL (optional)<input name="evidenceUrl" type="url" placeholder="https://" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Source description (optional)<input name="evidenceDescription" maxLength={500} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
    <label className="text-sm">Visibility<select name="visibility" defaultValue="investors" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="private">Only my company team</option><option value="investors">Approved investors</option><option value="public">Public profile</option></select></label>
    <div><SubmitButton pendingLabel="Submitting…">Add information</SubmitButton></div>
   </form>
   {claims.data?.length?<ul className="divide-y divide-line">{claims.data.map(c=><li key={c.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><Badge>{c.claim_type.replace("_"," ")}</Badge><Badge>{c.source_status.replace("_"," ")}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm">{c.claim_text}</p><p className="mt-1 text-xs text-muted">Visibility: {c.visibility}</p></li>)}</ul>:null}
  </CardBody></Card>
  <p className="text-xs text-muted">Nothing here is required to create, save, or publish your startup. Founder-reported information is labelled as such and is not represented as independently verified.</p>
 </div>;
}
