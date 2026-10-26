import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_TYPE = "image/png";

const GREEN = { deep: "#075B43", primary: "#087F5B", secondary: "#15966B", mint: "#E7F7EF" };

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#ffffff" />
      <g transform="rotate(35 16 16)">
        <ellipse cx="16" cy="16" rx="6.6" ry="10" fill={GREEN.primary} />
        <path d="M16 6.6c-3.6 4.6 3.6 9.2 0 14.4" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

const clamp = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Branded 1200×630 social card. Text only (no remote images): fast, and it never depends on user uploads. */
export function renderOg(input: { eyebrow: string; title: string; subtitle?: string | null; chips?: (string | null | undefined)[] }) {
  const title = clamp(input.title, 70);
  const fontSize = title.length > 48 ? 56 : title.length > 30 ? 68 : 84;
  const chips = (input.chips ?? []).filter((c): c is string => Boolean(c)).slice(0, 3);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#ffffff", background: `linear-gradient(135deg, ${GREEN.deep} 0%, ${GREEN.primary} 62%, ${GREEN.secondary} 100%)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Mark size={56} />
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Buna</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, padding: "8px 22px", borderRadius: 999, background: "rgba(255,255,255,0.16)" }}>{input.eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>{title}</div>
          {input.subtitle ? <div style={{ display: "flex", fontSize: 34, lineHeight: 1.3, color: GREEN.mint }}>{clamp(input.subtitle, 120)}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {chips.map((c) => (
            <div key={c} style={{ display: "flex", fontSize: 26, padding: "8px 22px", borderRadius: 12, background: "#ffffff", color: GREEN.deep, fontWeight: 600 }}>{c}</div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
