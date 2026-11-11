import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

async function reviewProfile(formData: FormData) {
  "use server";
  await requireStaff();
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!userId || !["approved", "rejected"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("cofounder_profiles").update({ approval_status: status }).eq("user_id", userId);
  revalidatePath("/admin/cofounders");
  revalidatePath("/cofounders");
}

export default async function AdminCoFoundersPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: pending } = await supabase.from("cofounder_profiles")
    .select("user_id,headline,bio,location,skills,role_seeking,experience,accomplishments,website_url,linkedin_url,github_url,commitment,hours_per_week,work_style,idea_status,created_at")
    .eq("approval_status", "pending").order("created_at", { ascending: true }).limit(100);
  return <div className="container-page space-y-6 py-10">
    <div><h1 className="text-3xl font-bold">Co-Founder Discovery review</h1><p className="mt-2 text-muted">Approve genuine company-building intent. Reject recruitment ads, freelance/service pitches, spam, and misleading claims.</p></div>
    {!pending?.length ? <p className="rounded-xl border border-line p-6 text-muted">No profiles are waiting for review.</p> : <div className="space-y-4">{pending.map((p) => <article key={p.user_id} className="rounded-xl border border-line bg-surface p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Application</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{p.headline}</h2></div><span className="rounded-full border border-line px-3 py-1 text-xs text-muted">Awaiting review</span></div><p className="mt-1 text-sm text-muted">{p.location || "Location not provided"} · {p.user_id}</p><p className="mt-3 whitespace-pre-wrap text-sm">{p.bio}</p><div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Skills</p><p className="mt-1 text-sm">{(p.skills || []).join(", ") || "Not provided"}</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Seeking</p><p className="mt-1 text-sm">{(p.role_seeking || []).join(", ") || "Not provided"}</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Experience</p><p className="mt-1 whitespace-pre-wrap text-sm">{p.experience || "Not provided"}</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Accomplishments</p><p className="mt-1 whitespace-pre-wrap text-sm">{p.accomplishments || "Not provided"}</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Commitment</p><p className="mt-1 text-sm">{p.commitment?.replace("_"," ") || "Not specified"} · {p.hours_per_week ? p.hours_per_week+" hrs/week" : "Hours not specified"}</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Work style / idea status</p><p className="mt-1 text-sm">{p.work_style || "Not specified"} · {p.idea_status || "Not specified"}</p></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-3 text-sm">{p.website_url ? <a className="text-primary underline" href={p.website_url} target="_blank" rel="noreferrer">Website</a> : null}{p.linkedin_url ? <a className="text-primary underline" href={p.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a> : null}{p.github_url ? <a className="text-primary underline" href={p.github_url} target="_blank" rel="noreferrer">GitHub</a> : null}</div><form action={reviewProfile} className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4"><input type="hidden" name="user_id" value={p.user_id}/><button name="status" value="approved" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Approve</button><button name="status" value="rejected" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">Reject</button></form></article>)}</div>}
  </div>;
}
