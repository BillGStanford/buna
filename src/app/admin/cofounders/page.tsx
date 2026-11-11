import { revalidatePath } from "next/cache";
import { ArrowUpRight, Clock3, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

async function reviewProfile(formData: FormData) {
  "use server";
  await requireStaff();
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!userId || !["approved", "rejected"].includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("cofounder_profiles").update({ approval_status: status }).eq("user_id", userId).eq("approval_status", "pending");
  if (error) throw new Error("Could not update this application. Refresh and try again.");
  revalidatePath("/admin/cofounders");
  revalidatePath("/cofounders");
}

export default async function AdminCoFoundersPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: pending, error } = await supabase.from("cofounder_profiles")
    .select("user_id,headline,bio,location,skills,role_seeking,experience,accomplishments,website_url,linkedin_url,github_url,commitment,hours_per_week,work_style,idea_status,created_at")
    .eq("approval_status", "pending").order("created_at", { ascending: true }).limit(100);
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Members / Trust & safety</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Co-founder applications</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Review each opt-in profile before it enters the private member directory. Approve people seeking a genuine company-building partner—not a client, employer or freelance marketplace.</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5"><Users className="h-4 w-4 text-primary"/><span className="text-sm font-semibold tabular-nums">{pending?.length ?? 0}</span><span className="text-xs text-muted">pending</span></div>
      </header>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary"/>Staff-reviewed access</span><span className="h-1 w-1 rounded-full bg-line-strong"/><span>Oldest applications first</span><span className="h-1 w-1 rounded-full bg-line-strong"/><span>Maximum 100 shown</span></div>
      {error ? <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">The review queue could not be loaded. Check the database connection and refresh.</div> : null}
      {!error && !pending?.length ? <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-pale text-primary"><ShieldCheck className="h-5 w-5"/></span><h2 className="mt-4 text-base font-semibold text-ink">The queue is clear</h2><p className="mt-1 text-sm text-muted">There are no co-founder profiles waiting for review.</p></div> : null}
      <div className="space-y-4">{pending?.map((p, index) => <article key={p.user_id} className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-xs font-bold tabular-nums text-muted">{String(index+1).padStart(2,"0")}</span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Application for review</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{p.headline}</h2><p className="mt-1 text-xs text-muted">{p.location || "Location not provided"} <span className="mx-1.5">·</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>{formatDateTime(p.created_at)}</span></p></div></div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Pending decision</span>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <p className="max-w-4xl whitespace-pre-wrap text-sm leading-6 text-ink">{p.bio}</p>
          <div className="mt-5 grid gap-x-8 gap-y-5 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted">Skills offered</p><div className="mt-2 flex flex-wrap gap-1.5">{(p.skills || []).length ? p.skills.map((skill:string) => <span key={skill} className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-ink">{skill}</span>) : <span className="text-sm text-muted">Not provided</span>}</div></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted">Looking for</p><div className="mt-2 flex flex-wrap gap-1.5">{(p.role_seeking || []).length ? p.role_seeking.map((role:string) => <span key={role} className="rounded-md bg-primary-pale px-2 py-1 text-xs font-medium text-primary-deep">{role}</span>) : <span className="text-sm text-muted">Not provided</span>}</div></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted">Commitment</p><p className="mt-2 text-sm font-medium capitalize text-ink">{p.commitment?.replaceAll("_"," ") || "Not specified"}{p.hours_per_week ? ` · ${p.hours_per_week} hrs/week` : ""}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted">Experience</p><p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-ink">{p.experience || "Not provided"}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted">Accomplishments</p><p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-ink">{p.accomplishments || "Not provided"}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted">Working preferences</p><p className="mt-2 text-sm capitalize text-ink">{p.work_style?.replaceAll("_"," ") || "Not specified"} <span className="text-muted">·</span> {p.idea_status?.replaceAll("_"," ") || "Not specified"}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-xs">
            {p.website_url ? <a className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={p.website_url} target="_blank" rel="noopener noreferrer nofollow">Website <ExternalLink className="h-3 w-3"/></a> : null}
            {p.linkedin_url ? <a className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={p.linkedin_url} target="_blank" rel="noopener noreferrer nofollow">LinkedIn <ExternalLink className="h-3 w-3"/></a> : null}
            {p.github_url ? <a className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={p.github_url} target="_blank" rel="noopener noreferrer nofollow">GitHub <ExternalLink className="h-3 w-3"/></a> : null}
            <span className="ml-auto break-all text-[10px] text-muted">Member ID: {p.user_id}</span>
          </div>
        </div>
        <form action={reviewProfile} className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-subtle/55 px-5 py-4 sm:px-6">
          <p className="max-w-xl text-xs leading-5 text-muted">Approval makes this opted-in profile discoverable to other approved members. Rejection keeps it out of the directory.</p>
          <div className="flex shrink-0 gap-2"><input type="hidden" name="user_id" value={p.user_id}/><button name="status" value="rejected" className="rounded-lg border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-danger/40 hover:text-danger">Reject</button><button name="status" value="approved" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-deep">Approve profile <ArrowUpRight className="h-3.5 w-3.5"/></button></div>
        </form>
      </article>)}</div>
    </div>
  );
}
