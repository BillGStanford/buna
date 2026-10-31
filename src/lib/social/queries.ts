import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Maker, LaunchCardData } from "@/lib/launches/queries";
import { countryName } from "@/lib/geo";

export async function followerCount(type: "startup" | "user", id: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("follower_count", { p_type: type, p_id: id });
  return Number(data ?? 0);
}

export async function isFollowing(userId: string | null, type: "startup" | "user", id: string): Promise<boolean> {
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("target_id").eq("follower_id", userId).eq("target_type", type).eq("target_id", id).maybeSingle();
  return Boolean(data);
}

export type FollowedStartup = { id: string; slug: string; name: string; tagline: string | null; logo_url: string | null };

export async function listFollowing(userId: string): Promise<{ startups: FollowedStartup[]; people: Maker[] }> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("follows").select("target_type, target_id").eq("follower_id", userId).order("created_at", { ascending: false });
  const follows = (rows ?? []) as { target_type: string; target_id: string }[];
  const startupIds = follows.filter((f) => f.target_type === "startup").map((f) => f.target_id);
  const userIds = follows.filter((f) => f.target_type === "user").map((f) => f.target_id);
  const [startups, people] = await Promise.all([
    startupIds.length ? supabase.from("startups").select("id, slug, name, tagline, logo_url").in("id", startupIds).eq("status", "published") : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", userIds) : Promise.resolve({ data: [] }),
  ]);
  return { startups: (startups.data ?? []) as FollowedStartup[], people: (people.data ?? []) as Maker[] };
}

export type PublicUser = {
  id: string; username: string; display_name: string; avatar_url: string | null; headline: string | null; bio: string | null;
  country: string | null; city: string | null; website_url: string | null; social_links: Record<string, string>;
  expertise: string[]; interests: string[]; open_to: string[]; is_public_profile: boolean; is_discoverable_founder: boolean;
};

export async function getPublicUser(username: string): Promise<PublicUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_profiles")
    .select("id, username, display_name, avatar_url, headline, bio, country, city, website_url, expertise, interests, open_to, is_public_profile, is_discoverable_founder")
    .eq("username", username).maybeSingle();
  if (error || !data) return null;
  // This narrowly scoped RPC returns links only when the profile is public or belongs to the signed-in viewer.
  const { data: links } = await supabase.rpc("get_public_profile_social_links", { p_user: data.id });
  return { ...(data as Omit<PublicUser, "social_links">), social_links: (links && typeof links === "object" && !Array.isArray(links) ? links : {}) as Record<string, string> };
}

export const locationOf = (u: Pick<PublicUser, "city" | "country">) => [u.city, countryName(u.country)].filter(Boolean).join(", ");

export async function getUserStartups(userId: string): Promise<(FollowedStartup & { public_title: string | null })[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("startup_members").select("public_title, startup:startups(id, slug, name, tagline, logo_url, status)").eq("user_id", userId).eq("is_public", true);
  return ((data ?? []) as unknown as { public_title: string | null; startup: (FollowedStartup & { status: string }) | (FollowedStartup & { status: string })[] | null }[]).flatMap((m) => {
    const s = Array.isArray(m.startup) ? m.startup[0] : m.startup;
    return s && s.status === "published" ? [{ ...s, public_title: m.public_title }] : [];
  });
}

export type UserLaunch = Pick<LaunchCardData, "id" | "slug" | "name" | "tagline" | "logo_url" | "vote_count" | "published_at" | "is_demo">;

export async function getUserLaunches(userId: string): Promise<UserLaunch[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("launches").select("id, slug, name, tagline, logo_url, vote_count, published_at, is_demo")
    .eq("submitted_by", userId).eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).limit(20);
  return (data ?? []) as UserLaunch[];
}
