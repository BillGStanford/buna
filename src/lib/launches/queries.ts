import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { LAUNCH_PAGE_SIZE } from "./constants";
import { periodSince, type LaunchParams } from "./params";
import { buildCommentTree, type CommentNode, type CommentRow } from "./comments";
import type { CategoryOption } from "@/lib/startups/queries";

export type Maker = { id: string; username: string; display_name: string; avatar_url: string | null };

export type LaunchCardData = {
  id: string; slug: string; name: string; tagline: string; logo_url: string | null; tags: string[]; status: string;
  launch_date: string | null; published_at: string | null; vote_count: number; comment_count: number;
  is_featured: boolean; is_demo: boolean; submitted_by: string | null;
  category: { slug: string; name: string } | null;
  startup: { slug: string; name: string; logo_url: string | null } | null;
  maker: Maker | null;
  voted: boolean;
};

const CARD_COLUMNS =
  "id, slug, name, tagline, logo_url, tags, status, launch_date, published_at, vote_count, comment_count, is_featured, is_demo, submitted_by, category:categories(slug, name), startup:startups(slug, name, logo_url)";

const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null));

async function decorate(rows: Record<string, unknown>[], userId: string | null): Promise<LaunchCardData[]> {
  const supabase = await createClient();
  const makerIds = [...new Set(rows.map((r) => r.submitted_by as string | null).filter((v): v is string => Boolean(v)))];
  const ids = rows.map((r) => r.id as string);
  const [makers, votes] = await Promise.all([
    makerIds.length ? supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", makerIds) : Promise.resolve({ data: [] }),
    userId && ids.length ? supabase.from("launch_votes").select("launch_id").in("launch_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const byId = new Map(((makers.data ?? []) as Maker[]).map((m) => [m.id, m]));
  const voted = new Set(((votes.data ?? []) as { launch_id: string }[]).map((v) => v.launch_id));
  return rows.map((r) => ({
    ...(r as unknown as LaunchCardData),
    category: one(r.category),
    startup: one(r.startup),
    maker: byId.get(r.submitted_by as string) ?? null,
    voted: voted.has(r.id as string),
  }));
}

export async function listLaunches(p: LaunchParams, categories: CategoryOption[], userId: string | null): Promise<{ items: LaunchCardData[]; total: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0 };
  const supabase = await createClient();
  let categoryId: string | null = null;
  if (p.category) {
    categoryId = categories.find((c) => c.slug === p.category)?.id ?? null;
    if (!categoryId) return { items: [], total: 0 };
  }
  const args = { p_sort: p.sort, p_category: categoryId, p_tag: p.tag || null, p_query: p.q || null, p_since: periodSince(p.period), p_limit: LAUNCH_PAGE_SIZE };
  const { data, error } = await supabase.rpc("list_launches", { ...args, p_offset: (p.page - 1) * LAUNCH_PAGE_SIZE });
  if (error) throw error;
  let rows = (data ?? []) as { id: string; total: number | string }[];
  let total = rows.length ? Number(rows[0]?.total ?? 0) : 0;
  if (rows.length === 0 && p.page > 1) {
    // past the last page: fetch the real total so the page can redirect
    const first = await supabase.rpc("list_launches", { ...args, p_limit: 1, p_offset: 0 });
    if (first.error) throw first.error;
    total = Number(((first.data ?? []) as { total: number | string }[])[0]?.total ?? 0);
    rows = [];
  }
  if (rows.length === 0) return { items: [], total };
  const ids = rows.map((r) => r.id);
  const { data: cards, error: cardError } = await supabase.from("launches").select(CARD_COLUMNS).in("id", ids);
  if (cardError) throw cardError;
  const decorated = await decorate((cards ?? []) as unknown as Record<string, unknown>[], userId);
  const byId = new Map(decorated.map((c) => [c.id, c]));
  return { items: ids.map((id) => byId.get(id)).filter((c): c is LaunchCardData => Boolean(c)), total };
}

export async function getTrendingForHome(userId: string | null, limit = 5): Promise<LaunchCardData[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_launches", { p_sort: "trending", p_category: null, p_tag: null, p_query: null, p_since: null, p_limit: limit, p_offset: 0 });
  if (error) throw error;
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data: cards } = await supabase.from("launches").select(CARD_COLUMNS).in("id", ids);
  const decorated = await decorate((cards ?? []) as unknown as Record<string, unknown>[], userId);
  const byId = new Map(decorated.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter((c): c is LaunchCardData => Boolean(c));
}

export type LaunchPage = LaunchCardData & {
  description: string | null; product_url: string; demo_video_url: string | null; moderation_note: string | null; startup_id: string | null;
  media: { id: string; url: string; alt_text: string | null }[];
  canEdit: boolean;
};

export async function getLaunchPage(slug: string, userId: string | null): Promise<LaunchPage | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("launches").select(`${CARD_COLUMNS}, description, product_url, demo_video_url, moderation_note, startup_id`).eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const [card] = await decorate([row as unknown as Record<string, unknown>], userId);
  if (!card) return null;
  const r = row as unknown as { id: string; description: string | null; product_url: string; demo_video_url: string | null; moderation_note: string | null; startup_id: string | null; submitted_by: string | null };

  const { data: media } = await supabase.from("launch_media").select("id, url, alt_text").eq("launch_id", r.id).order("sort_order").order("created_at");
  let canEdit = Boolean(userId && r.submitted_by === userId);
  if (userId && !canEdit && r.startup_id) {
    const { data: m } = await supabase.from("startup_members").select("role").eq("startup_id", r.startup_id).eq("user_id", userId).maybeSingle();
    canEdit = m?.role === "owner" || m?.role === "admin" || m?.role === "editor";
  }
  return { ...card, description: r.description, product_url: r.product_url, demo_video_url: r.demo_video_url, moderation_note: r.moderation_note, startup_id: r.startup_id, media: (media ?? []) as LaunchPage["media"], canEdit };
}

export async function getComments(launchId: string): Promise<CommentNode[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_launch_comments", { p_launch_id: launchId });
  if (error) throw error;
  return buildCommentTree((data ?? []) as CommentRow[]);
}

export async function getRelatedLaunches(launch: { id: string; category: { slug: string } | null }, categories: CategoryOption[], userId: string | null): Promise<LaunchCardData[]> {
  const categoryId = categories.find((c) => c.slug === launch.category?.slug)?.id;
  if (!categoryId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("launches").select(CARD_COLUMNS).eq("status", "published").eq("category_id", categoryId).neq("id", launch.id)
    .order("published_at", { ascending: false, nullsFirst: false }).limit(4);
  return decorate((data ?? []) as unknown as Record<string, unknown>[], userId);
}

export async function getSitemapLaunches(): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("launches").select("slug, updated_at").eq("status", "published").eq("is_demo", false).order("published_at", { ascending: false }).limit(5000);
    return (data ?? []) as { slug: string; updated_at: string }[];
  } catch {
    return [];
  }
}

// ---------- the maker's own launches ----------
export type MyLaunch = { id: string; slug: string; name: string; tagline: string; logo_url: string | null; status: string; moderation_note: string | null; vote_count: number; comment_count: number; launch_date: string | null };

export async function listMyLaunches(userId: string): Promise<MyLaunch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("launches")
    .select("id, slug, name, tagline, logo_url, status, moderation_note, vote_count, comment_count, launch_date")
    .eq("submitted_by", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyLaunch[];
}

export type ManagedLaunch = {
  id: string; slug: string; name: string; tagline: string; description: string | null; logo_url: string | null; product_url: string;
  demo_video_url: string | null; startup_id: string | null; category_id: string | null; tags: string[]; launch_date: string | null;
  status: string; moderation_note: string | null; vote_count: number; submitted_by: string | null;
  media: { id: string; url: string; alt_text: string | null; storage_path: string }[];
};

/** Loads a launch for editing. Access is checked explicitly: published launches are readable by everyone. */
export async function getManagedLaunch(launchId: string, userId: string): Promise<ManagedLaunch | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("launches").select("*").eq("id", launchId).maybeSingle();
  if (!row) return null;
  let allowed = row.submitted_by === userId;
  if (!allowed && row.startup_id) {
    const { data: m } = await supabase.from("startup_members").select("role").eq("startup_id", row.startup_id).eq("user_id", userId).maybeSingle();
    allowed = m?.role === "owner" || m?.role === "admin" || m?.role === "editor";
  }
  if (!allowed) return null;
  const { data: media } = await supabase.from("launch_media").select("id, url, alt_text, storage_path").eq("launch_id", launchId).order("sort_order").order("created_at");
  return { ...(row as Omit<ManagedLaunch, "media">), media: (media ?? []) as ManagedLaunch["media"] };
}

// ---------- moderation queue (staff; RLS lets staff read every launch) ----------
export type ModerationItem = MyLaunch & { description: string | null; product_url: string; category: { name: string } | null; maker: Maker | null; is_featured: boolean; created_at: string };

export async function listForModeration(status: "pending_review" | "published", limit = 30): Promise<ModerationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("launches")
    .select("id, slug, name, tagline, logo_url, status, moderation_note, vote_count, comment_count, launch_date, description, product_url, is_featured, created_at, submitted_by, category:categories(name)")
    .eq("status", status).order(status === "pending_review" ? "created_at" : "published_at", { ascending: status === "pending_review", nullsFirst: false }).limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (ModerationItem & { submitted_by: string | null })[];
  const makerIds = [...new Set(rows.map((r) => r.submitted_by).filter((v): v is string => Boolean(v)))];
  const { data: makers } = makerIds.length ? await supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", makerIds) : { data: [] };
  const byId = new Map(((makers ?? []) as Maker[]).map((m) => [m.id, m]));
  return rows.map((r) => ({ ...r, category: one(r.category), maker: r.submitted_by ? (byId.get(r.submitted_by) ?? null) : null }));
}

export async function getStartupLaunches(startupId: string, userId: string | null, limit = 6): Promise<LaunchCardData[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("launches").select(CARD_COLUMNS).eq("startup_id", startupId).eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false }).limit(limit);
  return decorate((data ?? []) as unknown as Record<string, unknown>[], userId);
}
