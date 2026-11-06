import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin"];
const GUEST_ONLY = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the auth session on every request. Forwarded request headers are retained
 * when Supabase refreshes cookies so the per-request CSP nonce reaches the Next renderer.
 */
export async function updateSession(request: NextRequest, forwardedHeaders?: Headers) {
  const { pathname, search } = request.nextUrl;
  const nextResponse = () => {
    const headers = new Headers(request.headers);
    forwardedHeaders?.forEach((value, key) => headers.set(key, value));
    return NextResponse.next({ request: { headers } });
  };
  let response = nextResponse();

  if (!isSupabaseConfigured()) {
    if (matches(pathname, PROTECTED_PREFIXES)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=not_configured";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const env = getPublicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && matches(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && matches(pathname, GUEST_ONLY)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
