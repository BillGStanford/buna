import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

/** Cookie-less anonymous client for public, cacheable reads (OG images, sitemaps). Never carries a user session. */
export function createPublicClient() {
  if (!isSupabaseConfigured()) return null;
  const env = getPublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
