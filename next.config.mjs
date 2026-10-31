/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

// Content-Security-Policy (production only: Next's dev server needs eval and websockets).
// Inline scripts are allowed because Next.js emits inline bootstrap scripts; a nonce-based `strict-dynamic` policy is the
// documented upgrade path in docs/SECURITY.md. Everything else is locked down: no plugins, no framing, same-origin forms,
// images only from this site and the project's storage.
const supa = supabaseHost ? `https://${supabaseHost}` : "";
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supa}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supa} ${supa.replace("https:", "wss:")}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    const headers = [...securityHeaders, { key: "Cross-Origin-Opener-Policy", value: "same-origin" }];
    if (process.env.NODE_ENV === "production") headers.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
