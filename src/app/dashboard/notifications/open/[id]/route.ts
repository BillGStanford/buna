import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils";
import { uuidField } from "@/lib/validation/startup";

export const dynamic = "force-dynamic";

/** Marks a notification read, then sends the user to where it points (same-site paths only). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = request.nextUrl.origin;
  const parsed = uuidField.safeParse(id);
  const user = isSupabaseConfigured() ? await getUser() : null;
  if (!parsed.success || !user) return NextResponse.redirect(`${origin}/dashboard/notifications`);
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("url").eq("id", parsed.data).eq("user_id", user.id).maybeSingle();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data).eq("user_id", user.id).is("read_at", null);
  return NextResponse.redirect(`${origin}${safeRedirectPath(data?.url, "/dashboard/notifications")}`);
}
