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
] as const;

function safeSocialUrl(value: unknown, hosts: readonly string[]): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (!hosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function SocialLinks({ links }: { links: Record<string, string> | null | undefined }) {
  const visible = PLATFORMS.flatMap((platform) => {
    const href = safeSocialUrl(links?.[platform.key], platform.hosts);
    return href ? [{ ...platform, href }] : [];
  });
  if (visible.length === 0) return null;

  return (
    <nav aria-label="Social media links" className="mt-4 flex flex-wrap gap-2">
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
