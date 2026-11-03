import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type ActivityItem = {
  activity_id: string;
  activity_type: "launch" | "startup_update" | "founder_follow" | "opportunity_save";
  actor_id: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  subject: string;
  description: string;
  href: string;
  happened_at: string;
};

export async function listFollowingActivity(limit = 40): Promise<ActivityItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_following_activity", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as ActivityItem[];
}
