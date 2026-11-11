import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const NOTIFICATIONS_PAGE_SIZE = 20;

// Explicit columns only: email delivery internals are not readable by clients.
const COLUMNS = "id, type, title, body, url, read_at, created_at";

export type NotificationItem = { id: string; type: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

export async function unreadCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function listNotifications(userId: string, page: number): Promise<{ items: NotificationItem[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * NOTIFICATIONS_PAGE_SIZE;
  const { data, count, error } = await supabase.from("notifications").select(COLUMNS, { count: "exact" })
    .eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(from, from + NOTIFICATIONS_PAGE_SIZE - 1);
  if (error && error.code === "PGRST103") {
    const head = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId);
    return { items: [], total: head.count ?? 0 };
  }
  if (error) throw error;
  return { items: (data ?? []) as NotificationItem[], total: count ?? 0 };
}

export type NotificationPrefs = { email_comments: boolean; email_replies: boolean; email_moderation: boolean; email_referrals: boolean; email_work: boolean };

export async function getPreferences(userId: string): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_preferences").select("email_comments, email_replies, email_moderation, email_referrals, email_work").eq("user_id", userId).maybeSingle();
  return (data as NotificationPrefs | null) ?? { email_comments: true, email_replies: true, email_moderation: true, email_referrals: true, email_work: true };
}
