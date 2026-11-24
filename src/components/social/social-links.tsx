import { ExternalLink } from "lucide-react";

const PLATFORMS = [
  { key: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"] },
  { key: "x", label: "X", hosts: ["x.com", "twitter.com"] },
  { key: "github", label: "GitHub", hosts: ["github.com"] },
  { key: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { key: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { key: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { key: "facebook", label: "Facebook", hosts: ["facebook.com"] },
  { key: "threads", label: "Threads", hosts: ["threads.net"] },
  { key: "bluesky", label: "Bluesky", hosts: ["bsky.app"] },
  { key: "mastodon", label: "Mastodon", hosts: [] },
] as const;

function safeSocialUrl(value: unknown, hosts: readonly string[]): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (hosts.length > 0 && !hosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function SocialLinks({ links, primaryContactMethod = "none", contactEmail, websiteUrl }: { links: Record<string, string> | null | undefined; primaryContactMethod?: string | null; contactEmail?: string | null; websiteUrl?: string | null }) {
  const visible: { key: string; label: string; hosts: readonly string[]; href: string }[] = PLATFORMS.flatMap((platform) => {
    const href = safeSocialUrl(links?.[platform.key], platform.hosts);
    return href ? [{ ...platform, href }] : [];
  });
  const otherUrl = links?.other_url;
  if (typeof otherUrl === "string" && otherUrl.length <= 300) { try { const parsed = new URL(otherUrl); if (parsed.protocol === "https:" || parsed.protocol === "http:") visible.push({ key: "other", label: links?.other_label?.trim() || "Other", hosts: [], href: parsed.toString() }); } catch { /* Ignore invalid custom links. */ } }
  const selected = visible.find((item) => item.key === primaryContactMethod);
  const primary = primaryContactMethod === "email" && contactEmail ? { label: "Email", href: `mailto:${contactEmail}` } : primaryContactMethod === "website" && websiteUrl ? { label: "Website", href: websiteUrl } : selected ? { label: selected.label, href: selected.href } : null;
  if (visible.length === 0 && !primary) return null;

  return (
    <nav aria-label="Social media and contact links" className="mt-4 flex flex-wrap gap-2">
      {primary ? <a href={primary.href} target={primary.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-pale px-3 py-1.5 text-sm font-semibold text-primary no-underline hover:border-primary/50">Primary contact · {primary.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a> : null}
      {visible.map((item) => (
        <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink no-underline transition-colors hover:border-primary/40 hover:bg-primary-pale">
          {item.label}<ExternalLink className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </nav>
  );
}
