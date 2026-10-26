import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isStaff, isAdmin } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

/** The verified auth user for this request (validated against the auth server), or null. */
export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}

export async function requireProfile(nextPath?: string): Promise<Profile> {
  await requireUser(nextPath);
  const profile = await getProfile();
  // The signup trigger always creates a profile; a missing one means a broken account.
  if (!profile) redirect("/login?error=profile_missing");
  return profile;
}

/** For actions that create or change public content: blocks suspended accounts server-side. */
export async function requireActiveProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.is_suspended) redirect("/forbidden?reason=suspended");
  return profile;
}

export async function requireStaff(): Promise<Profile> {
  const profile = await requireProfile("/admin");
  if (!isStaff(profile.role) || profile.is_suspended) redirect("/forbidden");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile("/admin");
  if (!isAdmin(profile.role) || profile.is_suspended) redirect("/forbidden");
  return profile;
}
