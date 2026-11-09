import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { FOUNDER_PAGE_SIZE, INVESTOR_PAGE_SIZE, type FounderParams, type InvestorParams } from "./params";

export type FounderCard = {
  id: string; username: string; display_name: string; avatar_url: string | null; headline: string | null; bio: string | null;
  country: string | null; city: string | null; expertise: string[]; interests: string[]; open_to: string[];
  startups: { slug: string; name: string; public_title: string | null }[];
};

export async function listFounders(p: FounderParams): Promise<{ items: FounderCard[]; total: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0 };
  const supabase = await createClient();
  const columns = "id, username, display_name, avatar_url, headline, bio, country, city, expertise, interests, open_to";
  const build = (cols: string, options?: { count?: "exact"; head?: boolean }) => {
    let q = supabase.from("public_profiles").select(cols, options).eq("is_discoverable_founder", true);
    // p.q is sanitised by parseFounderParams (no commas, quotes, parentheses or wildcards)
    if (p.q) q = q.or(`display_name.ilike."*${p.q}*",headline.ilike."*${p.q}*",bio.ilike."*${p.q}*",username.ilike."*${p.q}*"`);
    if (p.country) q = q.eq("country", p.country);
    if (p.city) q = q.ilike("city", `%${p.city}%`);
    if (p.interest) q = q.contains("interests", [p.interest]);
    if (p.expertise) q = q.contains("expertise", [p.expertise]);
    if (p.openTo) q = q.contains("open_to", [p.openTo]);
    return q;
  };
  const from = (p.page - 1) * FOUNDER_PAGE_SIZE;
  const { data, count, error } = await build(columns, { count: "exact" }).order("display_name", { ascending: true }).order("id").range(from, from + FOUNDER_PAGE_SIZE - 1);
  if (error) {
    if (error.code === "PGRST103") {
      const head = await build("id", { count: "exact", head: true });
      return { items: [], total: head.count ?? 0 };
    }
    throw error;
  }
  const rows = (data ?? []) as unknown as Omit<FounderCard, "startups">[];
  const startupsByUser = await publicStartupsFor(rows.map((r) => r.id));
  return { items: rows.map((r) => ({ ...r, startups: startupsByUser.get(r.id) ?? [] })), total: count ?? 0 };
}

export async function publicStartupsFor(userIds: string[]): Promise<Map<string, { slug: string; name: string; public_title: string | null }[]>> {
  const out = new Map<string, { slug: string; name: string; public_title: string | null }[]>();
  if (userIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase.from("startup_members").select("user_id, public_title, startup:startups(slug, name, status)").in("user_id", userIds).eq("is_public", true);
  for (const row of (data ?? []) as unknown as { user_id: string; public_title: string | null; startup: { slug: string; name: string; status: string } | { slug: string; name: string; status: string }[] | null }[]) {
    const s = Array.isArray(row.startup) ? row.startup[0] : row.startup;
    if (!s || s.status !== "published") continue;
    out.set(row.user_id, [...(out.get(row.user_id) ?? []), { slug: s.slug, name: s.name, public_title: row.public_title }]);
  }
  return out;
}

export async function getSitemapFounders(): Promise<{ username: string }[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("public_profiles").select("username").eq("is_discoverable_founder", true).limit(5000);
    return (data ?? []) as { username: string }[];
  } catch { return []; }
}

export type InvestorData = {
  id: string; slug: string; name: string; description: string | null; website_url: string | null; country: string | null; regions: string[];
  stages: string[]; sectors: string[]; thesis: string | null; contact_url: string | null; verification_status: string; is_published: boolean; is_demo: boolean;
  investor_type: string | null; investment_min: number | null; investment_max: number | null; investment_currency: string; portfolio: string | null; public_contact_email: string | null; public_contact_phone: string | null; public_contact_whatsapp: string | null; public_contact_telegram: string | null; public_contact_facebook: string | null; public_contact_other_url: string | null;
};
const INVESTOR_COLUMNS = "id, slug, name, description, website_url, country, regions, stages, sectors, thesis, contact_url, verification_status, is_published, is_demo, investor_type, investment_min, investment_max, investment_currency, portfolio, public_contact_email, public_contact_phone, public_contact_whatsapp, public_contact_telegram, public_contact_facebook, public_contact_other_url";

export async function listInvestors(p: InvestorParams): Promise<{ items: InvestorData[]; total: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0 };
  const supabase = await createClient();
  const build = (cols: string, options?: { count?: "exact"; head?: boolean }) => {
    let q = supabase.from("investors").select(cols, options).eq("is_published", true);
    if (p.q) q = q.or(`name.ilike."*${p.q}*",description.ilike."*${p.q}*"`);
    if (p.stage) q = q.contains("stages", [p.stage]);
    if (p.sector) q = q.contains("sectors", [p.sector]);
    if (p.country) q = q.eq("country", p.country);
    return q;
  };
  const from = (p.page - 1) * INVESTOR_PAGE_SIZE;
  const { data, count, error } = await build(INVESTOR_COLUMNS, { count: "exact" }).order("name").order("id").range(from, from + INVESTOR_PAGE_SIZE - 1);
  if (error) {
    if (error.code === "PGRST103") {
      const head = await build("id", { count: "exact", head: true });
      return { items: [], total: head.count ?? 0 };
    }
    throw error;
  }
  return { items: (data ?? []) as unknown as InvestorData[], total: count ?? 0 };
}

export async function getInvestor(slug: string): Promise<InvestorData | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("investors").select(INVESTOR_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as InvestorData | null) ?? null;
}

export async function getSitemapInvestors(): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("investors").select("slug, updated_at").eq("is_published", true).eq("is_demo", false).limit(5000);
    return (data ?? []) as { slug: string; updated_at: string }[];
  } catch { return []; }
}
