import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";

export const runtime = "nodejs";

/** Resolve a domain icon through Google's favicon service without fetching user URLs server-side. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim();
  if (!raw || raw.length > 2048) return NextResponse.json({ error: "A valid website URL is required." }, { status: 400 });

  let website: URL;
  try {
    const candidate = raw.startsWith("http://") || raw.startsWith("https://") ? raw : "https://" + raw;
    website = new URL(candidate);
  } catch {
    return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
  }

  let hostname = website.hostname.toLowerCase();
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  const ipLiteral = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const privateHost = hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") || hostname.endsWith(".internal") ||
    hostname.startsWith("127.") || hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") || hostname.startsWith("169.254.") ||
    hostname.startsWith("172.16.") || hostname.startsWith("172.17.") ||
    hostname.startsWith("172.18.") || hostname.startsWith("172.19.") ||
    hostname.startsWith("172.20.") || hostname.startsWith("172.21.") ||
    hostname.startsWith("172.22.") || hostname.startsWith("172.23.") ||
    hostname.startsWith("172.24.") || hostname.startsWith("172.25.") ||
    hostname.startsWith("172.26.") || hostname.startsWith("172.27.") ||
    hostname.startsWith("172.28.") || hostname.startsWith("172.29.") ||
    hostname.startsWith("172.30.") || hostname.startsWith("172.31.");
  if (!["http:", "https:"].includes(website.protocol) || isIP(ipLiteral) !== 0 ||
      Boolean(website.username || website.password) || !hostname || privateHost) {
    return NextResponse.json({ error: "Private or unsupported website host." }, { status: 400 });
  }

  const provider = new URL("https://www.google.com/s2/favicons");
  provider.searchParams.set("domain", hostname);
  provider.searchParams.set("sz", "128");
  return NextResponse.redirect(provider, { status: 302, headers: {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    "X-Content-Type-Options": "nosniff",
  } });
}
