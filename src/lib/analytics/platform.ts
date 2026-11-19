import "server-only";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
export type PlatformEvent="signup_created"|"email_verified"|"onboarding_completed"|"launch_submitted"|"launch_published"|"launch_vote";
export async function recordPlatformEvent(eventType:PlatformEvent,path="/") {
 try {
  const jar=await cookies(),h=await headers(),visitorId=jar.get("buna_visitor_id")?.value??null,sessionId=jar.get("buna_session_id")?.value??null;
  const country=(h.get("x-vercel-ip-country")||"").toUpperCase(),countryCode=/^[A-Z]{2}$/.test(country)?country:"ZZ",db=createAdminClient();
  const {data:visitor}=visitorId?await db.from("platform_analytics_visitors").select("first_source,first_campaign,first_referrer_domain").eq("visitor_id",visitorId).maybeSingle():{data:null};
  const {error}=await db.from("platform_analytics_events").insert({
   event_type:eventType,visitor_id:visitorId,session_id:sessionId,
   path:path.startsWith("/")?path.slice(0,180).split(/[?#]/,1)[0]||"/":"/",
   source:visitor?.first_source??"direct",campaign:visitor?.first_campaign??null,
   referrer_domain:visitor?.first_referrer_domain??null,country_code:countryCode
  });
  if(error)throw error;
 } catch { /* Analytics must never interrupt a core action. */ }
}