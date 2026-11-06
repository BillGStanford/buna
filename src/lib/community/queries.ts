import "server-only";
import { createClient } from "@/lib/supabase/server";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "./constants";

export type CommunityAuthor = { id: string; username: string; display_name: string; avatar_url: string | null };
export type CommunityThread = {
  id: string; author_id: string; category: CommunityCategory; title: string; body: string;
  status: string; created_at: string; reply_count: number; author: CommunityAuthor | null;
};
export type CommunityReply = {
  id: string; thread_id: string; author_id: string; body: string; created_at: string;
  author: CommunityAuthor | null;
};

async function attachAuthors<T extends { author_id: string }>(rows: T[]) {
  const supabase = await createClient();
  const ids = [...new Set(rows.map((row) => row.author_id))];
  if (!ids.length) return new Map<string, CommunityAuthor>();
  const { data } = await supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", ids);
  return new Map(((data ?? []) as CommunityAuthor[]).map((profile) => [profile.id, profile]));
}

export async function listCommunityThreads(category?: string): Promise<CommunityThread[]> {
  const supabase = await createClient();
  let query = supabase.from("community_threads")
    .select("id, author_id, category, title, body, status, created_at")
    .eq("status", "published").order("created_at", { ascending: false }).limit(60);
  if (category && COMMUNITY_CATEGORIES.some((item) => item.value === category)) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Omit<CommunityThread, "author" | "reply_count">[];
  if (!rows.length) return [];
  const [authors, counts] = await Promise.all([
    attachAuthors(rows),
    supabase.from("community_replies").select("thread_id").eq("status", "published").in("thread_id", rows.map((row) => row.id)),
  ]);
  const countByThread = new Map<string, number>();
  for (const reply of counts.data ?? []) countByThread.set(reply.thread_id, (countByThread.get(reply.thread_id) ?? 0) + 1);
  return rows.map((row) => ({ ...row, author: authors.get(row.author_id) ?? null, reply_count: countByThread.get(row.id) ?? 0 }));
}

export async function getCommunityThread(id: string): Promise<{ thread: CommunityThread; replies: CommunityReply[] } | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("community_threads")
    .select("id, author_id, category, title, body, status, created_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const { data: replyRows, error: replyError } = await supabase.from("community_replies")
    .select("id, thread_id, author_id, body, created_at").eq("thread_id", id).eq("status", "published")
    .order("created_at", { ascending: true }).limit(300);
  if (replyError) throw replyError;
  const rows = (replyRows ?? []) as Omit<CommunityReply, "author">[];
  const authors = await attachAuthors([{ author_id: row.author_id }, ...rows]);
  return {
    thread: { ...(row as Omit<CommunityThread, "author" | "reply_count">), author: authors.get(row.author_id) ?? null, reply_count: rows.length },
    replies: rows.map((reply) => ({ ...reply, author: authors.get(reply.author_id) ?? null })),
  };
}
