import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyJsonImportAction, previewJsonImportAction, uploadImportedImageAction } from "./actions";

export const metadata: Metadata = { title: "Bulk import (admin)", robots: { index: false, follow: false } };
const input = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm";
const button = "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90";
const date = (v:string) => new Date(v).toLocaleString();

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
    startupIds.length ? db.from("startups").select("id,name,slug,logo_url").in("id",startupIds) : Promise.resolve({data:[]}),
    launchIds.length ? db.from("launches").select("id,name,slug,logo_url").in("id",launchIds) : Promise.resolve({data:[]}),
  ]);
  const byId = new Map([...(startupRows.data??[]),...(launchRows.data??[])].map(x=>[x.id,x]));
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
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted"><li>Validate the file and stage its rows.</li><li>Review the batch, then import as unpublished drafts.</li><li>Upload logos and screenshots directly in this page.</li><li>Founders can manage records in their normal dashboards; admins use Startups and Launches moderation.</li></ol>
        </div>
      </div>
      <div className="rounded-xl border border-line p-5">
        <h2 className="text-lg font-semibold">JSON structure</h2>
        <p className="mt-1 text-sm text-muted">Use one top-level object. Do not include images, passwords, roles, publication status, IDs, or moderation fields.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-pale p-3 text-xs leading-5">{JSON.stringify({version:1,type:"combined",startups:[{import_key:"startup-001",name:"Example",tagline:"A short description",description:"What the company does",website_url:"https://example.com",country:"ET",city:"Addis Ababa",stage:"mvp",founded_year:2025,category:"fintech",tags:["Payments"],founder:{email:"founder@example.com",display_name:"Example Founder"},links:[{kind:"linkedin",url:"https://linkedin.com/company/example"}]}],launches:[{import_key:"launch-001",name:"Example App",tagline:"A useful product for Africa",description:"Product description",product_url:"https://example.com",category:"fintech",tags:["Mobile"],founder:{email:"founder@example.com",display_name:"Example Founder"},startup_ref:"startup-001"}]},null,2)}</pre>
        <p className="mt-2 text-xs text-muted">For launches-only files use type: "launches". startup_ref can be an import_key in this batch or an existing startup slug the founder can manage.</p>
      </div>
    </section>
    {selected.data ? <section className="space-y-4 rounded-xl border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Selected batch</p><h2 className="mt-1 text-lg font-semibold">{selected.data.kind} · {selected.data.row_count} records</h2><p className="text-sm text-muted">{date(selected.data.created_at)} · {selected.data.status}</p></div>{["preview","partial","failed"].includes(selected.data.status)?<form action={applyJsonImportAction}><input type="hidden" name="id" value={selected.data.id}/><button className={button}>{selected.data.status==="preview"?"Import all valid rows as drafts":"Retry failed rows"}</button></form>:<div className="text-sm text-muted">{selected.data.imported_count} imported · {selected.data.error_count} failed</div>}</div>
      <div className="space-y-3">{(items??[]).map(item=>{const record=item.entity_id?byId.get(item.entity_id):null;return <article key={item.id} className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{String(item.payload.name??item.import_key)}</strong><p className="text-xs text-muted">{item.item_type} · {item.import_key} · {item.status}</p></div>{record?<Link className="text-sm font-semibold text-primary underline" href={item.item_type==="startup"?`/dashboard/startup/${record.id}`:`/dashboard/launches/${record.id}`}>Manage record ↗</Link>:null}</div>
        {item.error?<p className="mt-2 text-sm text-danger">{item.error}</p>:null}
        {record?<div className="mt-4 grid gap-3 sm:grid-cols-2">
          <form action={uploadImportedImageAction} encType="multipart/form-data" className="space-y-2 rounded-lg bg-pale p-3"><input type="hidden" name="entityType" value={item.item_type}/><input type="hidden" name="entityId" value={item.entity_id}/><input type="hidden" name="kind" value="logo"/><label className="block text-xs font-semibold">Upload {item.item_type} logo<input className="mt-1 block w-full text-xs" type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label><button className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold">Upload logo</button></form>
          <form action={uploadImportedImageAction} encType="multipart/form-data" className="space-y-2 rounded-lg bg-pale p-3"><input type="hidden" name="entityType" value={item.item_type}/><input type="hidden" name="entityId" value={item.entity_id}/><input type="hidden" name="kind" value="gallery"/><label className="block text-xs font-semibold">Upload {item.item_type==="startup"?"gallery image":"launch screenshot"}<input className="mt-1 block w-full text-xs" type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label><button className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold">Upload image</button></form>
        </div>:null}
      </article>})}</div>
    </section>:null}
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Import history</h2><p className="text-sm text-muted">Batches are retained for audit and safe review. Existing CSV imports under Operations are unchanged.</p></div>
      <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-pale text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Records</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"> </th></tr></thead><tbody>{(batches??[]).map(b=><tr key={b.id} className="border-t border-line"><td className="px-4 py-3 font-medium">{b.kind}</td><td className="px-4 py-3">{b.status}</td><td className="px-4 py-3 tabular-nums">{b.imported_count}/{b.row_count} · {b.error_count} errors</td><td className="px-4 py-3 text-muted">{date(b.created_at)}</td><td className="px-4 py-3"><Link className="font-semibold text-primary underline" href={`/admin/imports?batch=${b.id}`}>View</Link></td></tr>)}{!batches?.length?<tr><td className="px-4 py-5 text-muted" colSpan={5}>No JSON imports yet.</td></tr>:null}</tbody></table></div>
    </section>
  </div>;
}
