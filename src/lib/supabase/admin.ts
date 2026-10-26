import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Service-role client. BYPASSES row-level security.
 * Rules: server-only (the import above fails the build if a client component pulls it in);
 * only use after an explicit server-side authorization check; never forward raw user input
 * as a user id; write an audit log entry for privileged mutations.
 */
export function createAdminClient() {
  const pub = getPublicEnv();
  const server = getServerEnv();
  return createSupabaseClient(pub.NEXT_PUBLIC_SUPABASE_URL, server.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
