import { cn, initials } from "@/lib/utils";

export function Avatar({ name, src, size = 36, className }: {
  name: string | null | undefined; src?: string | null; size?: number; className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" style={style}
        className={cn("shrink-0 rounded-full border border-line object-cover", className)} />
    );
  }
  return (
    <span aria-hidden="true" style={style}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-primary-mint font-semibold text-primary-deep", className)}>
      {initials(name)}
    </span>
  );
}
