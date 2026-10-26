import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api", "/onboarding", "/login", "/signup", "/reset-password", "/forgot-password", "/verify-email", "/auth"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
