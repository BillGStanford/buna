import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyBulkImportAction, cancelFeaturedCampaignAction, createFeaturedCampaignAction,
  dispatchAnnouncementNowAction, mergeDuplicateStartupsAction, previewBulkImportAction,
  resolveUserDisputeAction, reviewCompanyCorrectionAction, schedulePlatformAnnouncementAction,
  updateSupportTicketAction,
} from "./actions";

export const metadata: Metadata = { title: "Operations (admin)", robots: { index: false, follow: false } };

const date = (value:string|null) => value ? new Date(value).toLocaleString() : "—";
const field = "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm";
const button = "inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white";

export default async function AdminOperationsPage() {
  await requireAdmin();
  const db=createAdminClient();
  const [tickets,disputes,corrections,startups,batches,announcements,campaigns,audit,counts] = await Promise.all([
    db.from("support_tickets").select("id,email,subject,body,status,priority,created_at").order("created_at",{ascending:false}).limit(50),
    db.from("user_disputes").select("id,user_id,subject,disputed_action,details,status,created_at").order("created_at",{ascending:false}).limit(50),
    db.from("startup_correction_requests").select("id,startup_id,field_name,current_value,proposed_value,reason,status,created_at").in("status",["submitted","reviewing"]).order("created_at",{ascending:false}).limit(50),
    db.from("startups").select("id,name,slug,status,is_featured").order("name").limit(300),
    db.from("admin_import_batches").select("id,kind,status,row_count,imported_count,error_summary,created_at").order("created_at",{ascending:false}).limit(20),
    db.from("platform_announcements").select("id,title,target,scheduled_at,status,sent_count,created_at").order("created_at",{ascending:false}).limit(20),
    db.from("featured_startup_campaigns").select("id,title,startup_id,starts_at,ends_at,status").order("starts_at",{ascending:false}).limit(30),
    db.from("audit_logs").select("id,action,entity_type,entity_id,created_at,actor_id").order("id",{ascending:false}).limit(20),
    Promise.all([
      db.from("support_tickets").select("id",{count:"exact",head:true}).in("status",["open","triaged","waiting"]),
      db.from("user_disputes").select("id",{count:"exact",head:true}).in("status",["submitted","under_review"]),
      db.from("startup_correction_requests").select("id",{count:"exact",head:true}).in("status",["submitted","reviewing"]),
      db.from("admin_import_batches").select("id",{count:"exact",head:true}).eq("status","preview"),
      db.from("platform_announcements").select("id",{count:"exact",head:true}).eq("status","scheduled"),
    ]),
  ]);
  const [openTickets,openDisputes,openCorrections,previewImports,scheduledAnnouncements]=counts.map(x=>x.count??0);
  const allStartups=(startups.data??[]) as {id:string;name:string;slug:string;status:string;is_featured:boolean}[];
  const published=allStartups.filter(s=>s.status==="published");
  return <div className="space-y-8">
    <header><h1 className="text-2xl font-bold">Operations & growth</h1><p className="mt-1 max-w-3xl text-sm text-muted">Privileged operational queues, imports, communications and campaigns. Every administrative decision is audited.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {([["Open support",openTickets],["Open disputes",openDisputes],["Corrections",openCorrections],["Import previews",previewImports],["Scheduled notices",scheduledAnnouncements]] as [string,number][]).map(([label,value])=><div key={label} className="rounded-lg border border-line p-4"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p></div>)}
    </section>

    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Support tickets</h2><p className="text-sm text-muted">Assign, prioritize and resolve inbound support cases.</p></div>
      {(tickets.data??[]).map(t=><article key={t.id} className="rounded-lg border border-line p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{t.subject}</strong><span className="text-xs text-muted">{date(t.created_at)}</span></div><p className="mt-1 text-sm text-muted">{t.email} · {t.status} · {t.priority}</p><p className="mt-2 whitespace-pre-wrap text-sm">{t.body}</p><form action={updateSupportTicketAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]"><input type="hidden" name="id" value={t.id}/><select name="status" defaultValue={t.status} className={field}><option value="open">Open</option><option value="triaged">Triaged</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select name="priority" defaultValue={t.priority} className={field}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><input name="note" placeholder="Resolution note (optional)" className={field}/><button className={button}>Save</button></form></article>)}{!tickets.data?.length?<p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">No support tickets yet.</p>:null}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">User disputes</h2>
      {(disputes.data??[]).map(d=><article key={d.id} className="rounded-lg border border-line p-4"><strong>{d.subject}</strong><p className="text-sm text-muted">@{d.user_id} · {d.disputed_action} · {d.status} · {date(d.created_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{d.details}</p><form action={resolveUserDisputeAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="id" value={d.id}/><select name="status" defaultValue="resolved" className={field}><option value="under_review">Under review</option><option value="resolved">Resolve in user&apos;s favor</option><option value="rejected">Reject dispute</option></select><input name="decision" required minLength={5} placeholder="Decision and explanation" className={field}/><button className={button}>Record decision</button></form></article>)}{!disputes.data?.length?<p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">No disputes submitted.</p>:null}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Company information corrections</h2><p className="text-sm text-muted">Accepted changes are applied only to the supported, allow-listed startup fields. Other fields require manual investigation.</p>
      {(corrections.data??[]).map(c=><article key={c.id} className="rounded-lg border border-line p-4"><strong>{c.startup_id}</strong><p className="text-sm text-muted">{c.field_name} · {c.status} · {date(c.created_at)}</p><p className="mt-2 text-sm">Current: {c.current_value||"—"}<br/>Proposed: {c.proposed_value}</p><p className="mt-1 text-sm">{c.reason}</p><form action={reviewCompanyCorrectionAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="id" value={c.id}/><select name="status" defaultValue="accepted" className={field}><option value="accepted">Accept & apply</option><option value="reviewing">Needs investigation</option><option value="rejected">Reject</option></select><input name="note" placeholder="Reviewer note" className={field}/><button className={button}>Review</button></form></article>)}{!corrections.data?.length?<p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">No pending corrections.</p>:null}
    </section>

    <section className="space-y-4"><div><h2 className="text-lg font-semibold">Startup duplicate merging</h2><p className="text-sm text-muted">Move team members and supported startup assets to a published canonical listing. The source listing is retained as removed with a merge reference; this does not delete the source record.</p></div>
      <form action={mergeDuplicateStartupsAction} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"><label className="text-sm">Duplicate/source listing<select name="source" required className={field}><option value="">Choose source</option>{allStartups.filter(s=>s.status!=="removed").map(s=><option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}</select></label><label className="text-sm">Canonical/published listing<select name="target" required className={field}><option value="">Choose target</option>{published.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-sm sm:col-span-2">Reason for merge<textarea name="note" required minLength={5} maxLength={1000} className="mt-1 min-h-20 w-full rounded-md border border-line bg-surface p-3 text-sm"/></label><button className={button}>Merge duplicate</button></form>
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Bulk startup & opportunity imports</h2><p className="text-sm text-muted">Upload CSV contents as text. Imports are staged first; imported listings are created as drafts and must pass normal review before publication. Maximum 1,000 rows per batch.</p>
      <div className="rounded-lg border border-line p-4"><p className="text-sm font-semibold">Startup CSV headers</p><code className="text-xs">name,tagline,description,website_url,country,city,stage</code><p className="mt-2 text-sm font-semibold">Opportunity CSV headers</p><code className="text-xs">title,organization,description,category,eligibility,countries,deadline,application_url,source_url,tags</code><p className="mt-1 text-xs text-muted">Use semicolons for countries and tags. Category must be grant, accelerator, competition, fellowship, job, event, mentorship or partnership.</p>
      <form action={previewBulkImportAction} className="mt-4 space-y-3"><select name="kind" className={field}><option value="startup">Startups</option><option value="opportunity">Opportunities</option></select><textarea name="csv" required rows={7} maxLength={1000000} placeholder="Paste CSV with a header row…" className="w-full rounded-md border border-line bg-surface p-3 font-mono text-xs"/><button className={button}>Validate & stage import</button></form></div>
      <div className="space-y-2">{(batches.data??[]).map(b=><article key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><div className="min-w-0 flex-1"><strong>{b.kind} · {b.row_count} rows</strong><p className="text-xs text-muted">{b.status} · {b.imported_count} imported · {date(b.created_at)}</p>{Array.isArray(b.error_summary)&&b.error_summary.length?<p className="mt-1 text-xs text-danger">{b.error_summary.length} row errors: {JSON.stringify(b.error_summary.slice(0,3))}</p>:null}</div>{b.status==="preview"?<form action={applyBulkImportAction}><input type="hidden" name="id" value={b.id}/><button className={button}>Import as drafts</button></form>:null}</article>)}</div>
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Scheduled platform announcements</h2><p className="text-sm text-muted">Times are interpreted in UTC. Automatic dispatch follows the configured daily cron; use “Send now” for an immediate announcement.</p><form action={schedulePlatformAnnouncementAction} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"><label className="text-sm">Title<input name="title" required minLength={3} maxLength={160} className={field}/></label><label className="text-sm">Audience<select name="target" className={field}><option value="all">All active users</option><option value="founders">Founders</option><option value="investors">Investors</option></select></label><label className="text-sm sm:col-span-2">Message<textarea name="body" required minLength={5} maxLength={5000} rows={3} className="w-full rounded-md border border-line bg-surface p-3 text-sm"/></label><label className="text-sm">In-app destination (optional)<input name="url" placeholder="/launches" className={field}/></label><label className="text-sm">Schedule time (UTC)<input name="scheduled_at" type="datetime-local" className={field}/></label><button className={button}>Schedule announcement</button></form>
      {(announcements.data??[]).map(a=><div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><div className="min-w-0 flex-1"><strong>{a.title}</strong><p className="text-xs text-muted">{a.target} · {a.status} · {date(a.scheduled_at)} · {a.sent_count} recipients</p></div>{a.status==="scheduled"?<form action={dispatchAnnouncementNowAction}><input type="hidden" name="id" value={a.id}/><button className={button}>Send now</button></form>:null}</div>)}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Featured startup campaigns</h2><p className="text-sm text-muted">Campaign dates are interpreted in UTC. Activation and expiry are synchronized by the configured daily cron.</p><form action={createFeaturedCampaignAction} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Published startup<select name="startup_id" required className={field}><option value="">Choose startup</option>{published.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-sm">Campaign name<input name="title" required minLength={3} maxLength={120} className={field}/></label><label className="text-sm">Starts (UTC)<input name="starts_at" type="datetime-local" required className={field}/></label><label className="text-sm">Ends (UTC)<input name="ends_at" type="datetime-local" required className={field}/></label><button className={button}>Create campaign</button></form>
      {(campaigns.data??[]).map(c=><div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><div className="min-w-0 flex-1"><strong>{c.title}</strong><p className="text-xs text-muted">{c.startup_id} · {c.status} · {date(c.starts_at)} – {date(c.ends_at)}</p></div>{["scheduled","active"].includes(c.status)?<form action={cancelFeaturedCampaignAction}><input type="hidden" name="id" value={c.id}/><button className="rounded-md border border-line px-3 py-2 text-sm">Cancel</button></form>:null}</div>)}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Recent administrator activity</h2><ol className="space-y-2">{(audit.data??[]).map(a=><li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 text-sm"><span><strong>{a.action}</strong> <span className="text-muted">· {a.entity_type} {a.entity_id}</span></span><span className="text-xs text-muted">{a.actor_id??"System"} · {date(a.created_at)}</span></li>)}</ol></section>
  </div>;
}
