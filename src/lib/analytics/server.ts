import "server-only";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Best-effort attribution for conversions completed through authenticated server actions. */
export async function trackStartupConversion(startupId: string, eventType: "follow" | "inquiry") {
  try {
    const jar = await cookies();
    const visitorId = jar.get("buna_visitor_id")?.value;
    const sessionId = jar.get("buna_session_id")?.value;
    if (!visitorId || !sessionId || !UUID.test(visitorId) || !UUID.test(sessionId)) return;

    const admin = createAdminClient();
    const [{ data: startup }, { data: visitor }] = await Promise.all([
      admin.from("startups").select("slug").eq("id", startupId).eq("status", "published").maybeSingle(),
      admin.from("startup_analytics_visitors").select("first_source, first_country_code").eq("startup_id", startupId).eq("visitor_id", visitorId).maybeSingle(),
    ]);
    if (!startup) return;
    await admin.from("startup_analytics_events").insert({
      startup_id: startupId,
      visitor_id: visitorId,
      session_id: sessionId,
      event_type: eventType,
      path: `/startups/${startup.slug}`,
      source: visitor?.first_source ?? "direct",
      country_code: visitor?.first_country_code ?? "ZZ",
      device_type: "unknown",
    });
  } catch {
    // Analytics must never prevent a follow or inquiry from succeeding.
  }
}
