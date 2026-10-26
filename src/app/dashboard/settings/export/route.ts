import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Downloads everything Buna holds about the signed-in person that they can read, as JSON. */
export async function GET() {
  const user = isSupabaseConfigured() ? await getUser() : null;
  if (!user) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });
  if (!(await rateLimit(`export:${user.id}`, 5, 3600))) return NextResponse.json({ error: "Too many exports. Try again later." }, { status: 429 });

  const supabase = await createClient();
  const [profile, preferences, memberships, launches, comments, votes, follows, saved, notifications, reports] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id),
    supabase.from("notification_preferences").select("*").eq("user_id", user.id),
    supabase.from("startup_members").select("startup_id, role, is_public, public_title, created_at, startup:startups(name, slug, status)").eq("user_id", user.id),
    supabase.from("launches").select("id, slug, name, tagline, description, product_url, status, vote_count, created_at").eq("submitted_by", user.id),
    supabase.from("comments").select("id, launch_id, parent_id, body, status, created_at, edited_at").eq("author_id", user.id),
    supabase.from("launch_votes").select("launch_id, created_at").eq("user_id", user.id),
    supabase.from("follows").select("target_type, target_id, created_at").eq("follower_id", user.id),
    supabase.from("saved_opportunities").select("opportunity_id, created_at").eq("user_id", user.id),
    supabase.from("notifications").select("id, type, title, body, url, read_at, created_at").eq("user_id", user.id),
    supabase.from("reports").select("target_type, target_id, reason, details, status, created_at").eq("reporter_id", user.id),
  ]).then((all) => all.map((r) => r.data ?? []));
  const body = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, emailConfirmedAt: user.email_confirmed_at, createdAt: user.created_at },
    profile, notificationPreferences: preferences, startupMemberships: memberships, launches, comments, votes, follows, savedOpportunities: saved, notifications, reportsYouFiled: reports,
    notes: "Inquiries you sent to startups are held by those startups' teams and aren't included here; contact us to request them.",
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="buna-data-export.json"`, "Cache-Control": "no-store" },
  });
}
