import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/permissions";

export type TeamMember = { user_id: string; role: MemberRole; is_public: boolean; public_title: string | null; created_at: string; username: string; display_name: string; avatar_url: string | null };
export type PendingInvite = { id: string; email: string; role: MemberRole; expires_at: string; created_at: string };

export async function getTeam(startupId: string): Promise<{ members: TeamMember[]; invitations: PendingInvite[] }> {
  const supabase = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("startup_members").select("user_id, role, is_public, public_title, created_at").eq("startup_id", startupId).order("created_at"),
    supabase.from("team_invitations").select("id, email, role, expires_at, created_at").eq("startup_id", startupId).eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const rows = (members ?? []) as Omit<TeamMember, "username" | "display_name" | "avatar_url">[];
  const { data: people } = rows.length ? await supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", rows.map((r) => r.user_id)) : { data: [] };
  const byId = new Map(((people ?? []) as { id: string; username: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
  const order: Record<string, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };
  return {
    members: rows.map((r) => ({ ...r, username: byId.get(r.user_id)?.username ?? "member", display_name: byId.get(r.user_id)?.display_name ?? "", avatar_url: byId.get(r.user_id)?.avatar_url ?? null }))
      .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9)),
    invitations: (invites ?? []) as PendingInvite[],
  };
}
