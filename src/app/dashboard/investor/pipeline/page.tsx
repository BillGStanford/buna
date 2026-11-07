import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { updateInvestorDealAction } from "@/app/dashboard/investor/actions";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
export const metadata: Metadata = { title: "Deal pipeline", robots: { index: false } };
const stages=["discovered","contacted","reviewing","meeting","passed"];
export default async function InvestorPipelinePage(){
 const profile=await requireProfile("/dashboard/investor/pipeline"); const {investor}=await getInvestorPortal(profile.id); if(!investor) redirect("/dashboard/investor");
 const supabase=await createClient(); const {data,error}=await supabase.from("investor_deals").select("id,stage,notes,created_at,updated_at,startup:startups(id,slug,name,tagline,country,stage,funding_round,fundraising_status,funding_target,funding_currency)").eq("investor_id",investor.id).order("updated_at",{ascending:false}).limit(200); if(error) throw error;
 const rows=(data??[]).flatMap((d)=>{const s=Array.isArray(d.startup)?d.startup[0]:d.startup; return s?[{...d,startup:s}]:[];});
 return <div className="space-y-5"><header><p className="text-sm text-muted"><Link href="/dashboard/investor">Investor workspace</Link></p><h1 className="text-2xl font-bold">Fundraising pipeline</h1><p className="mt-1 text-sm text-muted">Track companies from first discovery through contact, diligence, meetings or a pass decision.</p></header>
 <div className="grid gap-2 sm:grid-cols-5">{stages.map(stage=><div key={stage} className="rounded-lg border border-line p-3"><p className="text-xs uppercase text-muted">{stage}</p><p className="mt-1 text-2xl font-bold">{rows.filter(r=>r.stage===stage).length}</p></div>)}</div>
 {rows.length?<ul className="space-y-3">{rows.map(r=><li key={r.id} className="rounded-xl border border-line p-4"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold"><Link href={"/startups/"+r.startup.slug}>{r.startup.name}</Link></h2><p className="text-sm text-muted">{r.startup.tagline}</p><div className="mt-2 flex flex-wrap gap-1.5"><Badge>{r.startup.country||"Location not set"}</Badge>{r.startup.stage?<Badge>{r.startup.stage.replace(/_/g," ")}</Badge>:null>{r.startup.funding_round?<Badge>{r.startup.funding_round.replace(/_/g," ")}</Badge>:null}</div></div><Badge tone={r.stage==="meeting"?"green":"neutral"}>{r.stage}</Badge></div>
 <form action={updateInvestorDealAction} className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]"><input type="hidden" name="dealId" value={r.id}/><select name="stage" defaultValue={r.stage} className="rounded-md border border-line bg-canvas px-3 py-2 text-sm">{stages.map(s=><option key={s} value={s}>{s}</option>)}</select><input name="notes" defaultValue={r.notes??""} placeholder="Private investment notes…" className="rounded-md border border-line bg-canvas px-3 py-2 text-sm"/><button className={buttonStyles("secondary","sm")} type="submit">Save</button></form>
 </li>)}</ul>:<p className="rounded-lg border border-line p-6 text-sm text-muted">Your pipeline is empty. <Link className="underline" href="/dashboard/investor/discover">Discover startups</Link> and add promising companies.</p>}</div>;
}