import "server-only";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_PAGE = 25;
export type Overview = { users: number; users_suspended: number; startups_published: number; startups_pending: number; launches_pending: number; verifications_pending: number; reports_open: number; messages_new: number; opportunities_stale: number };

export async function getOverview(): Promise<Overview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  return error ? null : (data as Overview);
}

export type AdminUser = { id: string; username: string; display_name: string; email: string | null; role: string; is_suspended: boolean; suspended_reason: string | null; created_at: string; total: number };
export async function searchUsers(q: string, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search_users", { p_query: q || null, p_limit: ADMIN_PAGE, p_offset: (page - 1) * ADMIN_PAGE });
  if (error) throw error;
  const rows = (data ?? []) as AdminUser[];
  return { rows, total: Number(rows[0]?.total ?? 0) };
}

export type AdminStartup = { id: string; slug: string; name: string; status: string; verification_status: string; is_featured: boolean; is_demo: boolean; created_at: string };
export async function listStartupsAdmin(status: string, q: string, page: number) {
  const supabase = await createClient();
  let query = supabase.from("startups").select("id, slug, name, status, verification_status, is_featured, is_demo, created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);
  const from = (page - 1) * ADMIN_PAGE;
  const { data, count, error } = await query.range(from, from + ADMIN_PAGE - 1);
  if (error && error.code !== "PGRST103") throw error;
  return { rows: (data ?? []) as AdminStartup[], total: count ?? 0 };
}

export type AdminReport = { id: string; target_type: string; target_id: string; reason: string; details: string | null; status: string; created_at: string; handled_at: string | null; resolution_note: string | null; reporter_username: string | null; target_label: string | null; target_url: string | null; target_state: string | null; same_target_count: number; total: number };
export async function listReports(status: string, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_reports", { p_status: status, p_limit: ADMIN_PAGE, p_offset: (page - 1) * ADMIN_PAGE });
  if (error) throw error;
  const rows = ((data ?? []) as AdminReport[]).map((r) => ({ ...r, same_target_count: Number(r.same_target_count), total: Number(r.total) }));
  return { rows, total: rows[0]?.total ?? 0 };
}

export type VerificationItem = { id: string; startup_id: string; notes: string | null; evidence_paths: string[]; created_at: string; startup: { name: string; slug: string; website_url: string | null; country: string | null } | null; links: { name: string; url: string }[] };
export async function listPendingVerifications(): Promise<VerificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("verification_requests").select("id, startup_id, notes, evidence_paths, created_at, startup:startups(name, slug, website_url, country)").eq("status", "pending").order("created_at");
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<VerificationItem, "startup" | "links"> & { startup: VerificationItem["startup"] | VerificationItem["startup"][] })[];
  return Promise.all(rows.map(async (r) => {
    // short-lived signed links: evidence is private and never publicly addressable
    const links: VerificationItem["links"] = [];
    for (const path of r.evidence_paths ?? []) {
      const { data: signed } = await supabase.storage.from("verification-docs").createSignedUrl(path, 300);
      if (signed?.signedUrl) links.push({ name: path.split("/").pop() ?? path, url: signed.signedUrl });
    }
    return { ...r, startup: (Array.isArray(r.startup) ? r.startup[0] : r.startup) ?? null, links };
  }));
}

export async function listVerifiedStartups() {
  const supabase = await createClient();
  const { data } = await supabase.from("startups").select("id, slug, name, verified_at").eq("verification_status", "verified").order("verified_at", { ascending: false }).limit(100);
  return (data ?? []) as { id: string; slug: string; name: string; verified_at: string | null }[];
}

export type AuditRow = { id: number; action: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown>; created_at: string; actor: { username: string } | null };
export async function listAudit(action: string, entity: string, page: number) {
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, action, entity_type, entity_id, metadata, created_at, actor:profiles(username)", { count: "exact" }).order("id", { ascending: false });
  if (action) q = q.like("action", `${action}%`);
  if (entity) q = q.eq("entity_type", entity);
  const from = (page - 1) * 50;
  const { data, count, error } = await q.range(from, from + 49);
  if (error && error.code !== "PGRST103") throw error;
  const rows = ((data ?? []) as unknown as (Omit<AuditRow, "actor"> & { actor: AuditRow["actor"] | AuditRow["actor"][] })[]).map((r) => ({ ...r, actor: Array.isArray(r.actor) ? (r.actor[0] ?? null) : r.actor }));
  return { rows: rows as AuditRow[], total: count ?? 0 };
}

export async function getSettings(): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_platform_settings");
  return Object.fromEntries(((data ?? []) as { key: string; value: unknown }[]).map((s) => [s.key, s.value === true]));
}

export async function listAllCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, slug, name, description, sort_order, is_active").order("sort_order").order("name");
  return (data ?? []) as { id: string; slug: string; name: string; description: string | null; sort_order: number; is_active: boolean }[];
}

export async function listFeatured() {
  const supabase = await createClient();
  const [s, l] = await Promise.all([
    supabase.from("startups").select("id, slug, name").eq("is_featured", true).eq("status", "published").order("name"),
    supabase.from("launches").select("id, slug, name").eq("is_featured", true).eq("status", "published").order("name"),
  ]);
  return { startups: (s.data ?? []) as { id: string; slug: string; name: string }[], launches: (l.data ?? []) as { id: string; slug: string; name: string }[] };
}
