import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function createContentSecurityPolicy(nonce: string): string {
  let supabaseOrigin = "";
  try {
    const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (configured) supabaseOrigin = new URL(configured).origin;
  } catch {
    // An invalid URL is rejected by the environment validator when Supabase is used.
  }
  const websocketOrigin = supabaseOrigin.replace(/^https:/, "wss:");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${websocketOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return updateSession(request);

  // Next.js reads the nonce from the request CSP and applies it to framework-injected scripts.
  const nonce = btoa(crypto.randomUUID());
  const csp = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
