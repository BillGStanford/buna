import "server-only";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
export type PlatformEvent="signup_created"|"email_verified"|"onboarding_completed"|"launch_published"|"launch_vote";
export async function recordPlatformEvent(eventType:PlatformEvent,path="/") {
 try {
  const jar=await cookies(), h=await headers(), country=(h.get("x-vercel-ip-country")||"").toUpperCase();
  const {error}=await createAdminClient().from("platform_analytics_events").insert({
   event_type:eventType,visitor_id:jar.get("buna_visitor_id")?.value??null,session_id:jar.get("buna_session_id")?.value??null,
   path:path.startsWith("/")?path.slice(0,180).split(/[?#]/,1)[0]||"/":"/",country_code:/^[A-Z]{2}$/.test(country)?country:"ZZ"
  });
  if(error) throw error;
 } catch { /* Analytics must never interrupt a core action. */ }
}