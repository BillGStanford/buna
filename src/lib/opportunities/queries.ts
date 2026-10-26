import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { OPPORTUNITY_PAGE_SIZE } from "./constants";
import type { OpportunityParams } from "./params";

export type OpportunityCardData = {
  id: string; slug: string; title: string; organization: string; category: string; deadline: string | null; countries: string[];
  status: string; tags: string[]; is_demo: boolean; saved: boolean;
};
export type OpportunityDetail = OpportunityCardData & {
  description: string | null; eligibility: string | null; application_url: string | null; source_url: string | null;
  published_date: string | null; last_checked_at: string | null; created_at: string;
};

const CARD = "id, slug, title, organization, category, deadline, countries, status, tags, is_demo";
const DETAIL = `${CARD}, description, eligibility, application_url, source_url, published_date, last_checked_at, created_at`;

async function savedSet(ids: string[], userId: string | null): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("saved_opportunities").select("opportunity_id").in("opportunity_id", ids);
  return new Set(((data ?? []) as { opportunity_id: string }[]).map((r) => r.opportunity_id));
}

export async function listOpportunities(p: OpportunityParams, userId: string | null): Promise<{ items: OpportunityCardData[]; total: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0 };
  const supabase = await createClient();
  const args = { p_when: p.when, p_category: p.category || null, p_country: p.country || null, p_query: p.q || null, p_sort: p.sort, p_limit: OPPORTUNITY_PAGE_SIZE };
  const { data, error } = await supabase.rpc("list_opportunities", { ...args, p_offset: (p.page - 1) * OPPORTUNITY_PAGE_SIZE });
  if (error) throw error;
  let rows = (data ?? []) as { id: string; total: number | string }[];
  let total = rows.length ? Number(rows[0]?.total ?? 0) : 0;
  if (rows.length === 0 && p.page > 1) {
    const head = await supabase.rpc("list_opportunities", { ...args, p_limit: 1, p_offset: 0 });
    if (head.error) throw head.error;
    total = Number(((head.data ?? []) as { total: number | string }[])[0]?.total ?? 0);
    rows = [];
  }
  if (rows.length === 0) return { items: [], total };
  const ids = rows.map((r) => r.id);
  const { data: cards, error: cardError } = await supabase.from("opportunities").select(CARD).in("id", ids);
  if (cardError) throw cardError;
  const saved = await savedSet(ids, userId);
  const byId = new Map(((cards ?? []) as Omit<OpportunityCardData, "saved">[]).map((c) => [c.id, { ...c, saved: saved.has(c.id) }]));
  return { items: ids.map((id) => byId.get(id)).filter((c): c is OpportunityCardData => Boolean(c)), total };
}

export async function getOpportunity(slug: string, userId: string | null): Promise<OpportunityDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunities").select(DETAIL).eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Omit<OpportunityDetail, "saved">;
  // visitors only ever receive published or expired rows (RLS); staff may preview drafts and archived listings
  return { ...row, saved: (await savedSet([row.id], userId)).has(row.id) };
}

export async function getOpenForHome(limit = 3): Promise<OpportunityCardData[]> {
  if (!isSupabaseConfigured()) return [];
  const { items } = await listOpportunities({ q: "", category: "", country: "", when: "open", sort: "deadline", page: 1 }, null);
  return items.slice(0, limit);
}

export async function listSavedOpportunities(userId: string): Promise<OpportunityCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("saved_opportunities").select(`created_at, opportunity:opportunities(${CARD})`).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { opportunity: Omit<OpportunityCardData, "saved"> | Omit<OpportunityCardData, "saved">[] | null }[]).flatMap((r) => {
    const o = Array.isArray(r.opportunity) ? r.opportunity[0] : r.opportunity;
    return o ? [{ ...o, saved: true }] : [];
  });
}

export async function getSitemapOpportunities(): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("opportunities").select("slug, updated_at").eq("status", "published").eq("is_demo", false).limit(5000);
    return (data ?? []) as { slug: string; updated_at: string }[];
  } catch { return []; }
}

export async function listForAdmin(status: string, q: string, limit = 100) {
  const supabase = await createClient();
  let query = supabase.from("opportunities").select(`${CARD}, last_checked_at, source_url, updated_at`).order("updated_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as (Omit<OpportunityCardData, "saved"> & { last_checked_at: string | null; source_url: string | null; updated_at: string })[];
}

export async function getForAdmin(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("opportunities").select("*").eq("id", id).maybeSingle();
  return data as (OpportunityDetail & { published_date: string | null }) | null;
}
