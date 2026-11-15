import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/forms/submit-button";
import { addCompanySourceAction, addCompanySourceRecordAction, reviewCompanySourceRecordAction } from "./actions";

export const metadata:Metadata={title:"Company data sources",robots:{index:false}};
export default async function CompanySourcesPage(){
 await requireStaff();
 const supabase=await createClient();
 const [sources,records]=await Promise.all([
  supabase.from("company_data_sources").select("id,name,source_type,base_url,country,is_active").order("name"),
  supabase.from("company_source_records").select("id,source_id,proposed_company_name,country,source_url,review_status,match_confidence,created_at,source:company_data_sources(name)").order("created_at",{ascending:false}).limit(100)
 ]);
 if(sources.error)throw sources.error;if(records.error)throw records.error;
 return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Company data sources</h1><p className="mt-1 text-sm text-muted">Maintain the source catalogue and stage records for human review. Records in this queue do not automatically create or modify public company profiles.</p></header>
 <Card><CardHeader><h2 className="font-semibold">Register a source</h2></CardHeader><CardBody><form action={addCompanySourceAction} className="grid gap-3 sm:grid-cols-2">
  <label className="text-sm">Source name<input name="name" required minLength={2} maxLength={120} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm">Source type<select name="sourceType" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2">{[["registry","Company registry"],["accelerator","Accelerator / incubator"],["publication","Publication"],["company_website","Company website"],["open_dataset","Open dataset"],["licensed_provider","Licensed provider"],["manual","Manual research"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <label className="text-sm">Base URL<input name="baseUrl" type="url" placeholder="https://" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm">Terms / usage policy URL<input name="termsUrl" type="url" placeholder="https://" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm">Country code<input name="country" maxLength={2} placeholder="ET" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm">Notes<input name="notes" maxLength={1000} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Register source</SubmitButton></div>
 </form>{sources.data?.length?<ul className="mt-4 divide-y divide-line">{sources.data.map(s=><li key={s.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{s.name} · {s.source_type.replace("_"," ")}</span><span className="text-muted">{s.country??"Multi-country"} · {s.base_url??"No URL"}</span></li>)}</ul>:null}</CardBody></Card>
 {sources.data?.length?<Card><CardHeader><h2 className="font-semibold">Stage a company record</h2><p className="text-sm text-muted">Use this for manually researched or imported source records. Automated provider connectors can feed the same staging table later.</p></CardHeader><CardBody><form action={addCompanySourceRecordAction} className="grid gap-3 sm:grid-cols-2">
  <label className="text-sm">Source<select name="sourceId" required className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2">{sources.data.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  <label className="text-sm">Company name<input name="companyName" required minLength={2} maxLength={160} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm">External record ID<input name="externalId" maxLength={200} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm">Source record URL<input name="sourceUrl" type="url" placeholder="https://" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm">Country code<input name="country" maxLength={2} placeholder="ET" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="text-sm sm:col-span-2">Raw source data (optional JSON)<textarea name="rawPayload" rows={3} placeholder='{"website":"https://example.com","sector":"fintech"}' className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <div className="sm:col-span-2"><SubmitButton pendingLabel="Staging…">Add to review queue</SubmitButton></div>
 </form></CardBody></Card>:null}
 <section className="space-y-3"><h2 className="font-semibold">Incoming records</h2>{records.data?.length?records.data.map(r=>{const source=Array.isArray(r.source)?r.source[0]:r.source;return <Card key={r.id}><CardBody className="space-y-3 py-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium">{r.proposed_company_name}</p><p className="text-xs text-muted">{source?.name??"Source"} · {r.country??"Country unknown"} · {new Date(r.created_at).toLocaleDateString()}</p>{r.source_url?<a href={r.source_url} target="_blank" rel="noreferrer" className="text-xs underline">Open source record</a>:null}</div><Badge>{r.review_status}</Badge></div><form action={reviewCompanySourceRecordAction} className="grid gap-2 sm:grid-cols-3"><input type="hidden" name="recordId" value={r.id}/><label className="text-sm">Decision<select name="status" defaultValue={r.review_status==="pending"?"matched":r.review_status} className="mt-1 w-full rounded-md border border-line bg-canvas px-2 py-2"><option value="matched">Match existing company</option><option value="created">New company created</option><option value="duplicate">Duplicate</option><option value="rejected">Reject</option></select></label><label className="text-sm">Startup UUID (for matched / created)<input name="startupId" placeholder="Existing startup ID" className="mt-1 w-full rounded-md border border-line bg-canvas px-2 py-2"/></label><label className="text-sm">Review note<input name="reviewNote" maxLength={1000} className="mt-1 w-full rounded-md border border-line bg-canvas px-2 py-2"/></label><div className="sm:col-span-3"><button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Save review</button></div></form></CardBody></Card>}):<Card><CardBody className="py-8 text-center text-sm text-muted">No source records have been staged.</CardBody></Card>}</section>
 </div>;
}
