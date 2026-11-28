import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyJsonImportAction, previewJsonImportAction, uploadImportedImageAction, updateImportedDetailsAction, submitImportedRecordForReviewAction } from "./actions";

export const metadata: Metadata = { title: "Bulk import (admin)", robots: { index: false, follow: false } };
const input = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm";
const button = "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90";
const date = (v:string) => new Date(v).toLocaleString();
type ImportedRecord = {
  id: string; name: string; slug: string; status: string; logo_url: string | null;
  tagline: string | null; description: string | null; website_url?: string | null;
  country?: string | null; city?: string | null; stage?: string | null; founded_year?: number | null;
  problem_statement?: string | null; solution?: string | null; target_customers?: string[] | null;
  target_geographies?: string[] | null; market_opportunity?: string | null; business_model?: string | null;
  is_product_live?: boolean; funding_round?: string | null; fundraising_status?: string | null;
  funding_target?: number | null; funding_currency?: string | null; product_url?: string | null;
  demo_video_url?: string | null; launch_date?: string | null; tags?: string[] | null;
};

export default async function AdminImportsPage({ searchParams }: { searchParams: Promise<{batch?:string}> }) {
  await requireAdmin();
  const { batch: batchId } = await searchParams;
  const db = createAdminClient();
  const [{data:batches}, selected] = await Promise.all([
    db.from("admin_content_import_batches").select("id,kind,status,row_count,imported_count,error_count,created_at").order("created_at",{ascending:false}).limit(30),
    batchId ? db.from("admin_content_import_batches").select("id,kind,status,row_count,imported_count,error_count,created_at").eq("id",batchId).maybeSingle() : Promise.resolve({data:null}),
  ]);
  const {data:items} = selected.data ? await db.from("admin_content_import_items").select("id,item_type,import_key,status,entity_id,founder_id,error,payload").eq("batch_id",selected.data.id).order("created_at") : {data:[]};
  const records = (items??[]).filter(x=>x.status==="imported"&&x.entity_id);
  const startupIds = records.filter(x=>x.item_type==="startup").map(x=>x.entity_id);
  const launchIds = records.filter(x=>x.item_type==="launch").map(x=>x.entity_id);
  const [startupRows,launchRows] = await Promise.all([
    startupIds.length ? db.from("startups").select("id,name,slug,logo_url,status,tagline,description,website_url,country,city,stage,founded_year,problem_statement,solution,target_customers,target_geographies,market_opportunity,business_model,is_product_live,funding_round,fundraising_status,funding_target,funding_currency").in("id",startupIds) : Promise.resolve({data:[]}),
    launchIds.length ? db.from("launches").select("id,name,slug,logo_url,status,tagline,description,product_url,demo_video_url,launch_date,tags").in("id",launchIds) : Promise.resolve({data:[]}),
  ]);
  const byId = new Map<string, ImportedRecord>([...(startupRows.data??[]),...(launchRows.data??[])].map((x): [string, ImportedRecord] => [x.id, x as unknown as ImportedRecord]));
  return <div className="space-y-7">
    <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Content operations</p><h1 className="mt-1 text-2xl font-bold">Bulk import</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Create real Buna startup and launch records from a JSON file. Founder accounts are matched by email or invited. Images are uploaded separately after import—never embedded in JSON.</p></header>
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <div className="rounded-xl border border-line p-5">
        <h2 className="text-lg font-semibold">Start a new import</h2>
        <p className="mt-1 text-sm text-muted">JSON version 1 · up to 100 startups and 200 launches per batch · 2 MB maximum.</p>
        <form action={previewJsonImportAction} className="mt-4 space-y-3">
          <label className="block text-sm font-medium">JSON file<input className={input+" mt-1 py-2"} type="file" name="json" accept=".json,application/json" required /></label>
          <button className={button}>Validate and stage JSON</button>
        </form>
        <div className="mt-5 rounded-lg bg-pale p-4 text-sm">
          <p className="font-semibold">What happens next</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted"><li>Validate the file and stage its rows.</li><li>Review the batch, then import as unpublished drafts.</li><li>Upload logos and screenshots directly in this page.</li><li>Founders continue in the company editor to complete required information and upload a logo; the draft remains private.</li></ol>
        </div>
      </div>
      <div className="rounded-xl border border-line p-5">
        <h2 className="text-lg font-semibold">JSON structure</h2>
        <p className="mt-1 text-sm text-muted">Use one top-level object. Do not include images, passwords, roles, publication status, IDs, or moderation fields.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-pale p-3 text-xs leading-5">{JSON.stringify({version:1,type:"combined",startups:[{import_key:"startup-001",name:"Example",tagline:"A short description",description:"What the company does",website_url:"https://example.com",country:"ET",city:"Addis Ababa",stage:"mvp",founded_year:2025,problem_statement:"Small businesses struggle with reliable payments.",solution:"A simple digital payment platform.",target_customers:["Small businesses"],target_geographies:["Ethiopia"],market_opportunity:"Growing digital commerce market.",business_model:"SaaS",is_product_live:true,funding_round:"pre_seed",fundraising_status:"raising",funding_target:250000,funding_currency:"USD",category:"fintech",tags:["Payments"],founder:{email:"founder@example.com",display_name:"Example Founder"},links:[{kind:"linkedin",url:"https://linkedin.com/company/example"}]}],launches:[{import_key:"launch-001",name:"Example App",tagline:"A useful product for Africa",description:"Product description",product_url:"https://example.com",category:"fintech",tags:["Mobile"],founder:{email:"founder@example.com",display_name:"Example Founder"},startup_ref:"startup-001"}]},null,2)}</pre>
        <p className="mt-2 text-xs text-muted">For launches-only files use type: &quot;launches&quot;. startup_ref can be an import_key in this batch or an existing startup slug the founder can manage.</p>
      </div>
    </section>
    {selected.data ? <section className="space-y-4 rounded-xl border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Selected batch</p><h2 className="mt-1 text-lg font-semibold">{selected.data.kind} · {selected.data.row_count} records</h2><p className="text-sm text-muted">{date(selected.data.created_at)} · {selected.data.status}</p></div>{["preview","partial","failed"].includes(selected.data.status)?<form action={applyJsonImportAction}><input type="hidden" name="id" value={selected.data.id}/><button className={button}>{selected.data.status==="preview"?"Import all valid rows as drafts":"Retry failed rows"}</button></form>:<div className="text-sm text-muted">{selected.data.imported_count} imported · {selected.data.error_count} failed</div>}</div>
      <div className="space-y-3">{(items??[]).map(item=>{const record=item.entity_id?byId.get(item.entity_id):undefined;return <article key={item.id} className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{String(item.payload.name??item.import_key)}</strong><p className="text-xs text-muted">{item.item_type} · {item.import_key} · {item.status}</p></div>{record?<Link className="text-sm font-semibold text-primary underline" href={item.item_type==="startup"?"/admin/startups":"/admin/launches"}>Open admin queue ↗</Link>:null}</div>
        {item.error?<p className="mt-2 text-sm text-danger">{item.error}</p>:null}
        {record?<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-pale p-3"><div><p className="text-xs font-semibold">Record status: {record.status}</p>{item.item_type==="startup"?<p className="mt-1 text-xs text-muted">{record.logo_url?"Company logo uploaded":"Company logo still required before review"}</p>:null}</div><div className="flex flex-wrap items-center gap-2">{item.item_type==="startup"?<span className="text-xs text-muted">Founder next: sign in, open Dashboard → Your companies → Manage, and complete the profile checklist.</span>:null}{record.status==="draft"&&(item.item_type!=="startup"||Boolean(record.logo_url))?<form action={submitImportedRecordForReviewAction} className="flex items-center gap-2"><input type="hidden" name="entityType" value={item.item_type}/><input type="hidden" name="entityId" value={item.entity_id}/><button className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white">Send to moderation</button></form>:null}</div></div>:null}
        {record?<div className="mt-3 rounded-lg bg-pale p-3"><p className="text-sm font-semibold">{record.tagline||String(item.payload.tagline??"No tagline added yet")}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-muted">{record.description||String(item.payload.description??"Description not added yet")}</p><p className="mt-2 text-[11px] text-muted">Draft preview · not publicly published</p></div>:null}
        {record?<><details className="mt-4 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Complete or edit optional details</summary>
          {item.item_type==="startup"?<form action={updateImportedDetailsAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="entityType" value="startup"/><input type="hidden" name="entityId" value={item.entity_id}/>
            <label className="text-xs font-medium">Tagline<input name="tagline" maxLength={160} defaultValue={record.tagline??""} className={input}/></label>
            <label className="text-xs font-medium">Website<input name="website_url" defaultValue={record.website_url??""} className={input}/></label>
            <label className="text-xs font-medium">Country code<input name="country" maxLength={2} defaultValue={record.country??""} placeholder="ET" className={input}/></label>
            <label className="text-xs font-medium">City<input name="city" defaultValue={record.city??""} className={input}/></label>
            <label className="text-xs font-medium">Stage<select name="stage" defaultValue={record.stage??""} className={input}><option value="">Not set</option>{["idea","prototype","mvp","early_revenue","growth","scale"].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-xs font-medium">Founded year<input name="founded_year" type="number" min="1900" max="2100" defaultValue={record.founded_year??""} className={input}/></label>
            <label className="text-xs font-medium sm:col-span-2">Category slug<input name="category" defaultValue={String(item.payload.category??"")} placeholder="e.g. fintech" className={input}/></label>
            <label className="text-xs font-medium sm:col-span-2">Description<textarea name="description" rows={3} defaultValue={record.description??""} className="w-full rounded-lg border border-line bg-surface p-2 text-sm"/></label>
            <label className="text-xs font-medium">Problem<textarea name="problem_statement" rows={3} defaultValue={record.problem_statement??""} className="w-full rounded-lg border border-line bg-surface p-2 text-sm"/></label>
            <label className="text-xs font-medium">Solution<textarea name="solution" rows={3} defaultValue={record.solution??""} className="w-full rounded-lg border border-line bg-surface p-2 text-sm"/></label>
            <label className="text-xs font-medium">Target customers (comma-separated)<input name="target_customers" defaultValue={record.target_customers?.join(", ")??""} className={input}/></label>
            <label className="text-xs font-medium">Target geographies (comma-separated)<input name="target_geographies" defaultValue={record.target_geographies?.join(", ")??""} className={input}/></label>
            <label className="text-xs font-medium sm:col-span-2">Market opportunity<textarea name="market_opportunity" rows={2} defaultValue={record.market_opportunity??""} className="w-full rounded-lg border border-line bg-surface p-2 text-sm"/></label>
            <label className="text-xs font-medium">Business model<input name="business_model" defaultValue={record.business_model??""} className={input}/></label>
            <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" name="is_product_live" defaultChecked={Boolean(record.is_product_live)}/> Product is live</label>
            <label className="text-xs font-medium">Funding round<select name="funding_round" defaultValue={record.funding_round??""} className={input}><option value="">Not set</option>{["pre_seed","seed","series_a","series_b","series_c","growth","debt","grant","other"].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-xs font-medium">Fundraising status<select name="fundraising_status" defaultValue={record.fundraising_status??"not_raising"} className={input}>{["not_raising","raising","open_to_conversations","closed"].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-xs font-medium">Funding target<input name="funding_target" type="number" min="0" step="0.01" defaultValue={record.funding_target??""} className={input}/></label>
            <label className="text-xs font-medium">Currency<input name="funding_currency" maxLength={3} defaultValue={record.funding_currency??"USD"} className={input}/></label>
            <button className={button}>Save startup details</button>
          </form>:<form action={updateImportedDetailsAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="entityType" value="launch"/><input type="hidden" name="entityId" value={item.entity_id}/>
            <label className="text-xs font-medium">Tagline<input name="tagline" required minLength={5} maxLength={160} defaultValue={record.tagline??""} className={input}/></label>
            <label className="text-xs font-medium">Product URL<input name="product_url" required defaultValue={record.product_url??""} className={input}/></label>
            <label className="text-xs font-medium">Demo video URL<input name="demo_video_url" defaultValue={record.demo_video_url??""} className={input}/></label>
            <label className="text-xs font-medium">Launch date<input name="launch_date" type="date" defaultValue={record.launch_date??""} className={input}/></label>
            <label className="text-xs font-medium">Category slug<input name="category" defaultValue={String(item.payload.category??"")} placeholder="e.g. fintech" className={input}/></label>
            <label className="text-xs font-medium">Tags (comma-separated)<input name="tags" defaultValue={record.tags?.join(", ")??""} className={input}/></label>
            <label className="text-xs font-medium sm:col-span-2">Description<textarea name="description" rows={3} defaultValue={record.description??""} className="w-full rounded-lg border border-line bg-surface p-2 text-sm"/></label>
            <button className={button}>Save launch details</button>
          </form>}
        </details>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <form action={uploadImportedImageAction} encType="multipart/form-data" className="space-y-2 rounded-lg bg-pale p-3"><input type="hidden" name="entityType" value={item.item_type}/><input type="hidden" name="entityId" value={item.entity_id}/><input type="hidden" name="kind" value="logo"/><label className="block text-xs font-semibold">Upload {item.item_type} logo<input className="mt-1 block w-full text-xs" type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label><button className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold">Upload logo</button></form>
          <form action={uploadImportedImageAction} encType="multipart/form-data" className="space-y-2 rounded-lg bg-pale p-3"><input type="hidden" name="entityType" value={item.item_type}/><input type="hidden" name="entityId" value={item.entity_id}/><input type="hidden" name="kind" value="gallery"/><label className="block text-xs font-semibold">Upload {item.item_type==="startup"?"gallery image":"launch screenshot"}<input className="mt-1 block w-full text-xs" type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label><button className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold">Upload image</button></form>
        </div></>:null}
      </article>})}</div>
    </section>:null}
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Import history</h2><p className="text-sm text-muted">Batches are retained for audit and safe review. Existing CSV imports under Operations are unchanged.</p></div>
      <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-pale text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Records</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"> </th></tr></thead><tbody>{(batches??[]).map(b=><tr key={b.id} className="border-t border-line"><td className="px-4 py-3 font-medium">{b.kind}</td><td className="px-4 py-3">{b.status}</td><td className="px-4 py-3 tabular-nums">{b.imported_count}/{b.row_count} · {b.error_count} errors</td><td className="px-4 py-3 text-muted">{date(b.created_at)}</td><td className="px-4 py-3"><Link className="font-semibold text-primary underline" href={`/admin/imports?batch=${b.id}`}>View</Link></td></tr>)}{!batches?.length?<tr><td className="px-4 py-5 text-muted" colSpan={5}>No JSON imports yet.</td></tr>:null}</tbody></table></div>
    </section>
  </div>;
}
