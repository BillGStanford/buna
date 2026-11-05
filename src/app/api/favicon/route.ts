import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";

export const runtime = "nodejs";

/**
 * Return Google's domain favicon for a validated public website URL.
 *
 * We deliberately do not fetch arbitrary user-controlled URLs from Buna's server.
 * Google's favicon endpoint performs the icon lookup, so this route cannot be
 * abused as an SSRF proxy into private infrastructure.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw || raw.length > 2048) {
    return NextResponse.json({ error: "A valid website URL is required." }, { status: 400 });
  }

  let website: URL;
  try {
    website = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
  }

  const hostname = website.hostname.toLowerCase().replace(/\.$/, "");
  const ipLiteral = hostname.replace(/^\[|\]$/g, "");
  const blocked =
    !["http:", "https:"].includes(website.protocol) ||
    isIP(ipLiteral) !== 0 ||
    Boolean(website.username || website.password) ||
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
    hostname === "::1";
  if (blocked) {
    return NextResponse.json({ error: "Private or unsupported website host." }, { status: 400 });
  }

  const provider = new URL("https://www.google.com/s2/favicons");
  provider.searchParams.set("domain", hostname);
  provider.searchParams.set("sz", "128");

  return NextResponse.redirect(provider, {
    status: 302,
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
