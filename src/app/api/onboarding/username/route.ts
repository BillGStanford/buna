import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export async function GET(request: NextRequest) {
  const username = (request.nextUrl.searchParams.get("username") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return NextResponse.json({ available: false, message: "Use 3–24 letters, numbers or underscores." });
  if (!isSupabaseConfigured()) return NextResponse.json({ available: false, message: "Username checks are unavailable right now." }, { status: 503 });
  const profile = await requireProfile("/onboarding");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("username", username).neq("id", profile.id).maybeSingle();
  if (error) return NextResponse.json({ available: false, message: "Could not check availability. We’ll verify when you continue." }, { status: 503 });
  return NextResponse.json({ available: !data, message: data ? "That username is taken. Try another." : "Username is available." });
}
