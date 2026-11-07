import { cn } from "@/lib/utils";

export function StartupLogo({ name, src, websiteUrl, size = 48, className }: { name: string; src?: string | null; websiteUrl?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  const imageSrc = src || (websiteUrl ? `/api/favicon?url=${encodeURIComponent(websiteUrl)}` : null);
  if (imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageSrc} alt={`${name} logo`} width={size} height={size} loading="lazy" decoding="async" style={style}
        className={cn("shrink-0 rounded-lg border border-line bg-surface object-contain", className)} />
    );
  }
  return (
    <span aria-hidden="true" style={{ ...style, fontSize: Math.round(size * 0.42) }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg bg-primary-mint font-bold text-primary-deep", className)}>
      {name.trim().charAt(0).toUpperCase() || "B"}
    </span>
  );
}
