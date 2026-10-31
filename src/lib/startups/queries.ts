import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { DIRECTORY_PAGE_SIZE } from "./constants";
import type { DirectoryParams } from "./params";
import type { MemberRole } from "@/lib/permissions";

export type StartupCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  stage: string | null;
  verification_status: string;
  is_featured: boolean;
  is_demo: boolean;
  published_at: string | null;
  updated_at: string;
  category: { slug: string; name: string } | null;
};

export type CategoryOption = { id: string; slug: string; name: string };
export type CategoryCount = { slug: string; name: string; startup_count: number };

const CARD_COLUMNS =
  "id, slug, name, tagline, logo_url, country, city, stage, verification_status, is_featured, is_demo, published_at, updated_at, category:categories(slug, name)";

function asCard(row: unknown): StartupCardData {
  const r = row as StartupCardData & { category: unknown };
  const category = Array.isArray(r.category) ? (r.category[0] ?? null) : r.category;
  return { ...r, category: (category as StartupCardData["category"]) ?? null };
}

export const listCategories = cache(async (): Promise<CategoryOption[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, slug, name").eq("is_active", true).order("sort_order");
  if (error) throw error;
  return (data ?? []) as CategoryOption[];
});

/**
 * Public directory query. `status = published` is explicit: row-level security would also show a
 * signed-in founder their own drafts, which must never appear in public listings.
 */
export async function listStartups(p: DirectoryParams, categories: CategoryOption[]): Promise<{ items: StartupCardData[]; total: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0 };
  const supabase = await createClient();

  let categoryId: string | null = null;
  if (p.category) {
    categoryId = categories.find((c) => c.slug === p.category)?.id ?? null;
    if (!categoryId) return { items: [], total: 0 };
  }

  const build = (columns: string, options?: { count?: "exact"; head?: boolean }) => {
    let query = supabase.from("startups").select(columns, options).eq("status", "published");
    if (p.q) {
      // q is sanitised by parseDirectoryParams (no commas, quotes, parentheses or wildcards).
      query = query.or(`name.ilike."*${p.q}*",search.wfts(english)."${p.q}"`);
    }
    if (p.country) query = query.eq("country", p.country);
    if (p.city) query = query.ilike("city", `%${p.city}%`);
    if (p.stage) query = query.eq("stage", p.stage);
    if (categoryId) query = query.eq("category_id", categoryId);
    return query;
  };

  let query = build(CARD_COLUMNS, { count: "exact" });
  if (p.sort === "name") query = query.order("name", { ascending: true });
  else if (p.sort === "featured") query = query.order("is_featured", { ascending: false }).order("published_at", { ascending: false, nullsFirst: false });
  else query = query.order("published_at", { ascending: false, nullsFirst: false });
  query = query.order("id", { ascending: true }); // stable pagination

  const from = (p.page - 1) * DIRECTORY_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + DIRECTORY_PAGE_SIZE - 1);
  if (error) {
    // PostgREST answers 416 when the offset is past the last row. Report the real total so the page can redirect.
    if (error.code === "PGRST103") {
      const { count: total, error: countError } = await build("id", { count: "exact", head: true });
      if (countError) throw countError;
      return { items: [], total: total ?? 0 };
    }
    throw error;
  }
  return { items: (data ?? []).map(asCard), total: count ?? 0 };
}

export async function getHomeData(): Promise<{ featured: StartupCardData[]; recent: StartupCardData[]; categories: CategoryCount[] }> {
  if (!isSupabaseConfigured()) return { featured: [], recent: [], categories: [] };
  const supabase = await createClient();
  const [featured, recent, counts] = await Promise.all([
    supabase.from("startups").select(CARD_COLUMNS).eq("status", "published").eq("is_featured", true)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false }).limit(3),
    supabase.from("startups").select(CARD_COLUMNS).eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false }).order("id").limit(6),
    supabase.rpc("published_category_counts"),
  ]);
  if (featured.error) throw featured.error;
  if (recent.error) throw recent.error;
  return {
    featured: (featured.data ?? []).map(asCard),
    recent: (recent.data ?? []).map(asCard),
    categories: ((counts.data ?? []) as { slug: string; name: string; startup_count: number | string }[])
      .map((c) => ({ slug: c.slug, name: c.name, startup_count: Number(c.startup_count) })),
  };
}

export type StartupProfile = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  country: string | null;
  city: string | null;
  stage: string | null;
  founded_year: number | null;
  tags: string[];
  status: string;
  verification_status: string;
  verified_at: string | null;
  is_demo: boolean;
  published_at: string | null;
  updated_at: string;
  category: { slug: string; name: string } | null;
  products: { id: string; name: string; description: string | null; url: string | null }[];
  links: { id: string; kind: string; url: string; label: string | null }[];
  media: { id: string; url: string; alt_text: string | null }[];
  team: { user_id: string; public_title: string | null; display_name: string; username: string; avatar_url: string | null }[];
  viewerRole: MemberRole | null;
};

/**
 * Loads a startup by slug under the viewer's own session. Visitors only ever receive published
 * startups (row-level security); a team member also receives their own draft, which powers preview.
 */
export const getStartupProfile = cache(async (slug: string): Promise<StartupProfile | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("startups")
    .select("*, category:categories(slug, name)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [products, links, media, members, user] = await Promise.all([
    supabase.from("startup_products").select("id, name, description, url").eq("startup_id", row.id).order("sort_order").order("created_at"),
    supabase.from("startup_links").select("id, kind, url, label").eq("startup_id", row.id).order("created_at"),
    supabase.from("startup_media").select("id, url, alt_text").eq("startup_id", row.id).eq("kind", "gallery").order("sort_order").order("created_at"),
    supabase.from("startup_members").select("user_id, role, is_public, public_title").eq("startup_id", row.id),
    getUser(),
  ]);

  const memberRows = (members.data ?? []) as { user_id: string; role: MemberRole; is_public: boolean; public_title: string | null }[];
  const publicMembers = memberRows.filter((m) => m.is_public);
  let team: StartupProfile["team"] = [];
  if (publicMembers.length > 0) {
    const { data: people } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", publicMembers.map((m) => m.user_id));
    const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
    team = publicMembers.flatMap((m) => {
      const p = byId.get(m.user_id);
      return p ? [{ user_id: m.user_id, public_title: m.public_title, display_name: p.display_name as string, username: p.username as string, avatar_url: (p.avatar_url as string | null) ?? null }] : [];
    });
  }

  const category = Array.isArray(row.category) ? (row.category[0] ?? null) : (row.category ?? null);
  return {
    ...(row as Omit<StartupProfile, "products" | "links" | "media" | "team" | "viewerRole" | "category">),
    category,
    products: (products.data ?? []) as StartupProfile["products"],
    links: (links.data ?? []) as StartupProfile["links"],
    media: (media.data ?? []) as StartupProfile["media"],
    team,
    viewerRole: user ? (memberRows.find((m) => m.user_id === user.id)?.role ?? null) : null,
  };
});

/** An old slug (kept in startup_slug_history) → the startup's current slug, for permanent redirects. */
export async function resolveRetiredSlug(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("startup_slug_history").select("startup:startups(slug, status)").eq("slug", slug).maybeSingle();
  const startup = (Array.isArray(data?.startup) ? data?.startup[0] : data?.startup) as { slug: string; status: string } | undefined;
  return startup && startup.status === "published" ? startup.slug : null;
}

export async function getSitemapStartups(): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("startups").select("slug, updated_at").eq("status", "published").eq("is_demo", false)
      .order("published_at", { ascending: false }).limit(5000);
    return (data ?? []) as { slug: string; updated_at: string }[];
  } catch {
    return [];
  }
}

// ---------------- owner workspace ----------------

export type MyStartup = {
  role: MemberRole;
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  status: string;
  verification_status: string;
  is_demo: boolean;
};

export async function listMyStartups(userId: string): Promise<MyStartup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startup_members")
    .select("role, startup:startups(id, slug, name, tagline, logo_url, status, verification_status, is_demo)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const s = (Array.isArray(row.startup) ? row.startup[0] : row.startup) as Omit<MyStartup, "role"> | undefined;
    return s ? [{ ...s, role: row.role as MemberRole }] : [];
  });
}

export type ManagedStartup = {
  role: MemberRole;
  startup: Record<string, unknown> & {
    id: string; slug: string; name: string; tagline: string | null; description: string | null; logo_url: string | null;
    website_url: string | null; country: string | null; city: string | null; category_id: string | null; stage: string | null;
    founded_year: number | null; tags: string[]; status: string; verification_status: string; is_demo: boolean;
  };
};

/**
 * Loads a startup for the owner workspace. Membership is checked explicitly: a published startup is
 * readable by everyone, so being able to select the row proves nothing about being allowed to manage it.
 */
export const getManagedStartup = cache(async (startupId: string, userId: string): Promise<ManagedStartup | null> => {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("startup_members").select("role").eq("startup_id", startupId).eq("user_id", userId).maybeSingle();
  if (!membership) return null;
  const { data: startup } = await supabase.from("startups").select("*").eq("id", startupId).maybeSingle();
  if (!startup) return null;
  return { role: membership.role as MemberRole, startup: startup as ManagedStartup["startup"] };
});

export async function getManagedChildren(startupId: string) {
  const supabase = await createClient();
  const [products, links, media] = await Promise.all([
    supabase.from("startup_products").select("id, name, description, url").eq("startup_id", startupId).order("sort_order").order("created_at"),
    supabase.from("startup_links").select("id, kind, url, label").eq("startup_id", startupId).order("created_at"),
    supabase.from("startup_media").select("id, url, alt_text, storage_path").eq("startup_id", startupId).eq("kind", "gallery").order("sort_order").order("created_at"),
  ]);
  return {
    products: (products.data ?? []) as { id: string; name: string; description: string | null; url: string | null }[],
    links: (links.data ?? []) as { id: string; kind: string; url: string; label: string | null }[],
    media: (media.data ?? []) as { id: string; url: string; alt_text: string | null; storage_path: string }[],
  };
}
