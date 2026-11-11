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
    .select("user_id,headline,bio,location,skills,role_seeking,created_at")
    .eq("approval_status", "pending").order("created_at", { ascending: true }).limit(100);
  return <div className="container-page space-y-6 py-10">
    <div><h1 className="text-3xl font-bold">Co-Founder Discovery review</h1><p className="mt-2 text-muted">Approve only genuine company-building profiles. Reject job ads, service pitches, spam, and misleading profiles.</p></div>
    {!pending?.length ? <p className="rounded-xl border border-line p-6 text-muted">No profiles are waiting for review.</p> : <div className="space-y-4">{pending.map((p) => <article key={p.user_id} className="rounded-xl border border-line p-5"><h2 className="text-lg font-semibold">{p.headline}</h2><p className="mt-1 text-sm text-muted">{p.location || "Location not provided"} · {p.user_id}</p><p className="mt-3 whitespace-pre-wrap text-sm">{p.bio}</p><p className="mt-3 text-sm">Skills: {(p.skills || []).join(", ")}</p><p className="mt-1 text-sm">Seeking: {(p.role_seeking || []).join(", ")}</p><form action={reviewProfile} className="mt-4 flex gap-2"><input type="hidden" name="user_id" value={p.user_id}/><button name="status" value="approved" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Approve</button><button name="status" value="rejected" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">Reject</button></form></article>)}</div>}
  </div>;
}
