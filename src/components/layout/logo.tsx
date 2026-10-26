import Link from "next/link";

/** Coffee-bean mark ("buna" is coffee in Amharic) in the brand green. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="rgb(var(--primary))" />
      <g transform="rotate(35 16 16)">
        <ellipse cx="16" cy="16" rx="6.6" ry="10" fill="#fff" />
        <path d="M16 6.6c-3.6 4.6 3.6 9.2 0 14.4" stroke="rgb(var(--primary))" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Buna home" className={`inline-flex items-center gap-2 no-underline ${className ?? ""}`}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-primary-deep">Buna</span>
    </Link>
  );
}
