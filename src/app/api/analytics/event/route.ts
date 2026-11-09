import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  startupId: z.string().uuid(),
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventType: z.enum(["page_view", "product_click", "website_click", "launch_view", "follow", "inquiry"]),
  path: z.string().max(180).startsWith("/").refine((v) => !v.includes("?") && !v.includes("#")),
  referrerDomain: z.string().max(180).optional().nullable(),
  utmSource: z.string().max(80).optional().nullable(),
  campaign: z.string().max(120).optional().nullable(),
  deviceType: z.enum(["mobile", "desktop", "tablet", "unknown"]).default("unknown"),
});

function cleanDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const host = new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9.-]{1,180}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

function sourceFor(utmSource: string | null | undefined, referrer: string | null): string {
  const candidate = (utmSource || "").toLowerCase().trim();
  if (candidate && /^[a-z0-9_-]{1,80}$/.test(candidate)) return candidate;
  if (!referrer) return "direct";
  const host = referrer.toLowerCase();
  if (host.includes("reddit.")) return "reddit";
  if (host.includes("producthunt.")) return "producthunt";
  if (host.includes("linkedin.")) return "linkedin";
  if (host.includes("facebook.") || host.includes("instagram.")) return "meta";
  if (host.includes("t.me") || host.includes("telegram.")) return "telegram";
  if (host.includes("google.")) return "google";
  if (host.includes("bing.")) return "bing";
  if (host.includes("x.com") || host.includes("twitter.")) return "x";
  return "referral";
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const event = parsed.data;
  if (!(await rateLimit(`startup-analytics:${event.startupId}:${event.visitorId}`, 120, 3600))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const admin = createAdminClient();
    const { data: startup, error: startupError } = await admin
      .from("startups").select("id").eq("id", event.startupId).eq("status", "published").eq("is_demo", false).maybeSingle();
    if (startupError || !startup) return NextResponse.json({ ok: false }, { status: 404 });

    const referrerDomain = cleanDomain(event.referrerDomain);
    const country = (request.headers.get("x-vercel-ip-country") || "").toUpperCase();
    const countryCode = /^[A-Z]{2}$/.test(country) ? country : "ZZ";
    const { error } = await admin.from("startup_analytics_events").insert({
      startup_id: event.startupId,
      visitor_id: event.visitorId,
      session_id: event.sessionId,
      event_type: event.eventType,
      path: event.path,
      source: sourceFor(event.utmSource, referrerDomain),
      campaign: event.campaign?.replace(/[^a-zA-Z0-9 _.-]/g, "").slice(0, 120) || null,
      referrer_domain: referrerDomain,
      country_code: countryCode,
      device_type: event.deviceType,
    });
    if (error) throw error;

    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("buna_visitor_id", event.visitorId, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
