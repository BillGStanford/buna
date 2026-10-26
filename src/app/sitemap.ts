import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
import { getSitemapStartups } from "@/lib/startups/queries";
import { getSitemapLaunches } from "@/lib/launches/queries";
import { getSitemapOpportunities } from "@/lib/opportunities/queries";
import { getSitemapFounders, getSitemapInvestors } from "@/lib/people/queries";

// Always generated per request: it reflects the database, which a build-time snapshot would freeze.
export const dynamic = "force-dynamic";

/** Public, indexable routes only: published, non-demo startups and launches. Drafts and unpublished profiles never appear. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const [startups, launches, opportunities, founders, investors] = await Promise.all([getSitemapStartups(), getSitemapLaunches(), getSitemapOpportunities(), getSitemapFounders(), getSitemapInvestors()]);
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site}/startups`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/launches`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${site}/opportunities`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/founders`, changeFrequency: "daily", priority: 0.7 },
    { url: `${site}/investors`, changeFrequency: "weekly", priority: 0.7 },
    ...["about", "help", "contact", "privacy", "terms", "guidelines"].map((p) => ({ url: `${site}/${p}`, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...startups.map((s) => ({
      url: `${site}/startups/${s.slug}`,
      lastModified: new Date(s.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...opportunities.map((o) => ({ url: `${site}/opportunities/${o.slug}`, lastModified: new Date(o.updated_at), changeFrequency: "daily" as const, priority: 0.6 })),
    ...investors.map((i) => ({ url: `${site}/investors/${i.slug}`, lastModified: new Date(i.updated_at), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...founders.map((f) => ({ url: `${site}/founders/${f.username}`, changeFrequency: "weekly" as const, priority: 0.4 })),
    ...launches.map((l) => ({ url: `${site}/launches/${l.slug}`, lastModified: new Date(l.updated_at), changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
