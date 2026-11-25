import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { getManagedStartup } from "@/lib/startups/queries";
import { createClient } from "@/lib/supabase/server";
import {
  createChangelogAction, deleteChangelogAction, createMilestoneAction, updateMilestoneAction,
  deleteMilestoneAction, createAnnouncementAction, deleteAnnouncementAction,
  updateHiringStatusAction, submitCorrectionRequestAction
} from "../../updates/actions";

type ChangelogRow = { id:string; title:string; body:string; version:string|null; released_on:string; is_public:boolean };
type MilestoneRow = { id:string; title:string; description:string|null; target_date:string|null; completed_at:string|null; is_public:boolean };
type AnnouncementRow = { id:string; title:string; body:string; announcement_type:string; published_at:string|null; is_public:boolean };
type CorrectionRow = { id:string; field_name:string; status:string; proposed_value:string; created_at:string; reviewer_note:string|null };
type VerificationRow = { id:string; status:string; notes:string|null; decision_note:string|null; created_at:string; reviewed_at:string|null };
type ProfileChangeRow = { id:number; changed_fields:Record<string,{before:string|null;after:string|null}>; created_at:string };

export const metadata: Metadata = { title: "Company updates" };
const field = "w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm";
const button = "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export default async function StartupUpdatesPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const profile=await requireProfile(`/dashboard/startup/${id}/updates`);
  const managed=await getManagedStartup(id,profile.id);
  if(!managed) notFound();
  const db=await createClient();
  const [changelog,milestones,announcements,corrections,verification,profileChanges]=await Promise.all([
    db.from("startup_changelog").select("*").eq("startup_id",id).order("released_on",{ascending:false}),
    db.from("startup_milestones").select("*").eq("startup_id",id).order("sort_order").order("target_date"),
    db.from("startup_announcements").select("*").eq("startup_id",id).order("created_at",{ascending:false}),
    db.from("startup_correction_requests").select("*").eq("startup_id",id).order("created_at",{ascending:false}),
    db.from("verification_requests").select("id,status,notes,decision_note,created_at,reviewed_at").eq("startup_id",id).order("created_at",{ascending:false}),
    db.from("startup_profile_change_log").select("id,changed_fields,created_at").eq("startup_id",id).order("created_at",{ascending:false}).limit(50)
  ]);
  const s=managed.startup;
  return <div className="space-y-6">
    <Card><CardHeader><h2 className="font-semibold">Hiring status</h2><p className="text-sm text-muted">Show candidates whether your company is recruiting.</p></CardHeader><CardBody>
      <form action={updateHiringStatusAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="startupId" value={id}/>
        <select name="hiringStatus" defaultValue={String(s.hiring_status??"not_hiring")} className={field+" max-w-sm"}>
          <option value="not_hiring">Not currently hiring</option><option value="open_roles">Hiring for specific roles</option><option value="always_open">Open to exceptional candidates</option>
        </select><button className={button}>Save hiring status</button>
      </form>
    </CardBody></Card>

    <Card><CardHeader><h2 className="font-semibold">Company milestones</h2><p className="text-sm text-muted">Record funding, launches, customer growth, partnerships and other meaningful progress.</p></CardHeader><CardBody className="space-y-4">
      <form action={createMilestoneAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="startupId" value={id}/><input name="title" required maxLength={120} placeholder="Milestone title" className={field}/>
        <input name="targetDate" type="date" className={field}/><textarea name="description" rows={2} maxLength={3000} placeholder="What happened? (optional)" className={field+" sm:col-span-2"}/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="completed"/> Completed</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked/> Show publicly</label>
        <div><button className={button}>Add milestone</button></div>
      </form>
      <div className="divide-y divide-line">{(milestones.data??[]).map((m:MilestoneRow)=><div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div><p className="font-medium">{m.title}</p><p className="text-xs text-muted">{m.target_date??"No target date"} · {m.completed_at?"Completed":"In progress"} · {m.is_public?"Public":"Private"}</p>{m.description?<p className="mt-1 text-sm">{m.description}</p>:null}</div>
        <div className="flex gap-2"><form action={updateMilestoneAction}><input type="hidden" name="startupId" value={id}/><input type="hidden" name="milestoneId" value={m.id}/><label className="mr-2 text-xs"><input type="checkbox" name="completed" defaultChecked={Boolean(m.completed_at)}/> Done</label><label className="mr-2 text-xs"><input type="checkbox" name="isPublic" defaultChecked={m.is_public}/> Public</label><button className="text-xs underline">Update</button></form>
        <form action={deleteMilestoneAction}><input type="hidden" name="startupId" value={id}/><input type="hidden" name="milestoneId" value={m.id}/><button className="text-xs text-danger underline">Delete</button></form></div>
      </div>)}</div>
    </CardBody></Card>

    <Card><CardHeader><h2 className="font-semibold">Product releases and company announcements</h2><p className="text-sm text-muted">Publish release notes, company news, fundraising announcements, hiring updates and partnerships.</p></CardHeader><CardBody className="space-y-4">
      <form action={createAnnouncementAction} className="space-y-3">
        <input type="hidden" name="startupId" value={id}/><input name="title" required maxLength={160} placeholder="Announcement title" className={field}/>
        <select name="announcementType" className={field}><option value="company_news">Company news</option><option value="product_release">Product release</option><option value="fundraising">Fundraising</option><option value="hiring">Hiring</option><option value="partnership">Partnership</option><option value="other">Other</option></select>
        <textarea name="body" required rows={4} maxLength={8000} placeholder="Write your announcement…" className={field}/>
        <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="isPublic" defaultChecked/> Public</label><label className="flex items-center gap-2"><input type="checkbox" name="publish" defaultChecked/> Publish immediately</label></div>
        <button className={button}>Save announcement</button>
      </form>
      <div className="divide-y divide-line">{(announcements.data??[]).map((a:AnnouncementRow)=><div key={a.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{a.title}</p><p className="text-xs text-muted">{a.announcement_type.replace(/_/g," ")} · {a.published_at?"Published":"Draft"} · {a.is_public?"Public":"Private"}</p><p className="mt-1 whitespace-pre-line text-sm">{a.body}</p></div><form action={deleteAnnouncementAction}><input type="hidden" name="startupId" value={id}/><input type="hidden" name="announcementId" value={a.id}/><button className="text-xs text-danger underline">Delete</button></form></div>)}</div>
    </CardBody></Card>

    <Card><CardHeader><h2 className="font-semibold">Changelog</h2><p className="text-sm text-muted">Give customers and investors a dated record of product improvements.</p></CardHeader><CardBody className="space-y-4">
      <form action={createChangelogAction} className="space-y-3">
        <input type="hidden" name="startupId" value={id}/><div className="grid gap-3 sm:grid-cols-3"><input name="title" required maxLength={120} placeholder="Release title" className={field}/><input name="version" maxLength={40} placeholder="Version (optional)" className={field}/><input name="releasedOn" type="date" className={field}/></div>
        <textarea name="body" required rows={4} maxLength={5000} placeholder="What changed in this release?" className={field}/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked/> Show on public company profile</label><button className={button}>Add changelog entry</button>
      </form>
      <div className="divide-y divide-line">{(changelog.data??[]).map((entry:ChangelogRow)=><div key={entry.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{entry.version?entry.version+" · ":""}{entry.title}</p><p className="text-xs text-muted">{entry.released_on} · {entry.is_public?"Public":"Private"}</p><p className="mt-1 whitespace-pre-line text-sm">{entry.body}</p></div><form action={deleteChangelogAction}><input type="hidden" name="startupId" value={id}/><input type="hidden" name="entryId" value={entry.id}/><button className="text-xs text-danger underline">Delete</button></form></div>)}</div>
    </CardBody></Card>

    <Card><CardHeader><h2 className="font-semibold">Public data corrections</h2><p className="text-sm text-muted">Request a review of a field in Buna’s public company record. Your request and its status remain visible to your team.</p></CardHeader><CardBody className="space-y-4">
      <form action={submitCorrectionRequestAction} className="space-y-3">
        <input type="hidden" name="startupId" value={id}/><input name="fieldName" required maxLength={80} placeholder="Field to correct (e.g. founding year)" className={field}/>
        <textarea name="currentValue" rows={2} placeholder="Current public value (optional)" className={field}/><textarea name="proposedValue" required maxLength={5000} rows={2} placeholder="Correct information" className={field}/><textarea name="reason" required minLength={5} maxLength={2000} rows={2} placeholder="Explain the correction and supporting context" className={field}/>
        <button className={button}>Submit correction request</button>
      </form>
      <div className="divide-y divide-line">{(corrections.data??[]).map((r:CorrectionRow)=><div key={r.id} className="py-3 text-sm"><p className="font-medium">{r.field_name} · {r.status.replace(/_/g," ")}</p><p>Proposed: {r.proposed_value}</p><p className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</p>{r.reviewer_note?<p className="mt-1">{r.reviewer_note}</p>:null}</div>)}</div>
    </CardBody></Card>

    <Card><CardHeader><h2 className="font-semibold">Public profile change history</h2><p className="text-sm text-muted">An automatic record of important changes to your public company information.</p></CardHeader><CardBody>
      {(profileChanges.data??[]).length===0?<p className="text-sm text-muted">No profile changes have been recorded yet.</p>:<ul className="divide-y divide-line">{(profileChanges.data??[]).map((entry:ProfileChangeRow)=><li key={entry.id} className="py-3 text-sm"><p className="font-medium">{new Date(entry.created_at).toLocaleString()}</p><ul className="mt-2 list-disc pl-5">{Object.entries(entry.changed_fields??{}).map(([key,value])=><li key={key}><span className="font-medium">{key.replace(/_/g," ")}</span>: {String(value?.before??"—")} → {String(value?.after??"—")}</li>)}</ul></li>)}</ul>}
    </CardBody></Card>

    <Card><CardHeader><h2 className="font-semibold">Verification history</h2><p className="text-sm text-muted">A record of verification requests and review decisions.</p></CardHeader><CardBody>
      {(verification.data??[]).length===0?<p className="text-sm text-muted">No verification requests have been submitted.</p>:<ul className="divide-y divide-line">{(verification.data??[]).map((v:VerificationRow)=><li key={v.id} className="py-3 text-sm"><p className="font-medium">{v.status.replace(/_/g," ")}</p><p className="text-xs text-muted">Submitted {new Date(v.created_at).toLocaleDateString()}{v.reviewed_at?" · Reviewed "+new Date(v.reviewed_at).toLocaleDateString():""}</p>{v.notes?<p className="mt-1">Your notes: {v.notes}</p>:null}{v.decision_note?<p className="mt-1">Decision: {v.decision_note}</p>:null}</li>)}</ul>}
    </CardBody></Card>
  </div>;
}
