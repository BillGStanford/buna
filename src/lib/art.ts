// Single source of truth for Buna's artwork. Pure functions returning SVG markup, so the same art renders as
// themeable inline SVG in the app (CSS variables) and exports to static SVG/PNG files (hex colours).
// Plain TypeScript only (no enums/decorators) so Node can import it directly in scripts/assets/build.mjs.

export type Palette = { primary: string; deep: string; secondary: string; mint: string; pale: string; ink: string; muted: string; line: string; white: string; accent: string };

export const CSS_PALETTE: Palette = {
  primary: "rgb(var(--primary))", deep: "rgb(var(--primary-deep))", secondary: "rgb(var(--primary-secondary))",
  mint: "rgb(var(--mint))", pale: "rgb(var(--pale))", ink: "rgb(var(--ink))", muted: "rgb(var(--muted))", line: "rgb(var(--line))",
  white: "rgb(var(--surface))", accent: "rgb(var(--warning))",
};
export const HEX_PALETTE: Palette = {
  primary: "#087F5B", deep: "#075B43", secondary: "#15966B", mint: "#E7F7EF", pale: "#F3FBF6", ink: "#172B24", muted: "#64746B", line: "#E1EAE4", white: "#FFFFFF", accent: "#B7791F",
};

const svg = (viewBox: string, body: string, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" ${extra}>${body}</svg>`;

/** The coffee-bean mark ("buna" is coffee in Amharic). */
export function logoMark(p: Palette): string {
  return svg("0 0 32 32", `<rect width="32" height="32" rx="8" fill="${p.primary}"/><g transform="rotate(35 16 16)"><ellipse cx="16" cy="16" rx="6.6" ry="10" fill="#fff"/><path d="M16 6.6c-3.6 4.6 3.6 9.2 0 14.4" stroke="${p.primary}" stroke-width="1.9" stroke-linecap="round" fill="none"/></g>`);
}

export function logoLockup(p: Palette, light = false): string {
  const text = light ? "#FFFFFF" : p.deep;
  return svg("0 0 140 40", `<g transform="translate(4 4)"><rect width="32" height="32" rx="8" fill="${light ? "#FFFFFF" : p.primary}"/><g transform="rotate(35 16 16)"><ellipse cx="16" cy="16" rx="6.6" ry="10" fill="${light ? p.primary : "#fff"}"/><path d="M16 6.6c-3.6 4.6 3.6 9.2 0 14.4" stroke="${light ? "#FFFFFF" : p.primary}" stroke-width="1.9" stroke-linecap="round" fill="none"/></g></g><text x="46" y="28" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="24" font-weight="700" letter-spacing="-0.5" fill="${text}">Buna</text>`);
}

const leaf = (x: number, y: number, s: number, rot: number, fill: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0 C -14 -10 -12 -34 0 -44 C 12 -34 14 -10 0 0 Z" fill="${fill}"/><path d="M0 0 L0 -36" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/></g>`;
const dots = (x: number, y: number, cols: number, rows: number, gap: number, fill: string) =>
  Array.from({ length: cols * rows }, (_, i) => `<circle cx="${x + (i % cols) * gap}" cy="${y + Math.floor(i / cols) * gap}" r="2" fill="${fill}"/>`).join("");
const bar = (x: number, y: number, w: number, fill: string, h = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>`;

/** Landing-page hero: product cards (startup, launch, person, opportunity) connected to the Buna bean. */
export function heroArt(p: Palette): string {
  const card = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${p.white}" stroke="${p.line}" stroke-width="2"/>`;
  return svg("0 0 520 420", `
    <circle cx="260" cy="210" r="190" fill="${p.mint}"/>
    <circle cx="260" cy="210" r="150" stroke="${p.primary}" stroke-opacity=".25" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
    <circle cx="260" cy="210" r="104" stroke="${p.primary}" stroke-opacity=".18" stroke-width="2"/>
    ${dots(404, 28, 5, 5, 14, p.secondary).replace(/<circle/g, '<circle fill-opacity=".45"')}
    ${dots(240, 392, 5, 1, 14, p.secondary).replace(/<circle/g, '<circle fill-opacity=".35"')}
    <path d="M232 118 C 200 112, 170 112, 150 126" stroke="${p.primary}" stroke-width="2.5" stroke-dasharray="2 8" stroke-linecap="round"/>
    <path d="M292 120 C 330 110, 350 112, 372 120" stroke="${p.primary}" stroke-width="2.5" stroke-dasharray="2 8" stroke-linecap="round"/>
    <path d="M226 270 C 200 300, 190 312, 176 316" stroke="${p.primary}" stroke-width="2.5" stroke-dasharray="2 8" stroke-linecap="round"/>
    <path d="M296 268 C 330 296, 340 300, 352 306" stroke="${p.primary}" stroke-width="2.5" stroke-dasharray="2 8" stroke-linecap="round"/>
    <circle cx="150" cy="126" r="5" fill="${p.primary}"/><circle cx="372" cy="120" r="5" fill="${p.primary}"/><circle cx="176" cy="316" r="5" fill="${p.primary}"/><circle cx="352" cy="306" r="5" fill="${p.primary}"/>
    <g transform="translate(260 210)"><circle r="62" fill="${p.primary}"/><circle r="62" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><g transform="scale(2.4) translate(-16 -16)"><g transform="rotate(35 16 16)"><ellipse cx="16" cy="16" rx="6.6" ry="10" fill="#fff"/><path d="M16 6.6c-3.6 4.6 3.6 9.2 0 14.4" stroke="${p.primary}" stroke-width="1.9" stroke-linecap="round" fill="none"/></g></g></g>
    ${leaf(258, 146, 0.78, -10, p.secondary)}${leaf(276, 150, 0.5, 28, p.primary)}${leaf(262, 276, 0.66, 180, p.secondary)}
    ${card(26, 62, 200, 100)}<rect x="44" y="80" width="40" height="40" rx="10" fill="${p.mint}"/><path d="M64 112 C 54 106, 55 92, 64 86 C 73 92, 74 106, 64 112 Z" fill="${p.secondary}"/>${bar(98, 84, 96, p.line, 10)}${bar(98, 102, 70, p.line)}<rect x="44" y="132" width="62" height="16" rx="8" fill="${p.mint}"/><rect x="112" y="132" width="44" height="16" rx="8" fill="${p.pale}" stroke="${p.line}"/>
    ${card(300, 40, 200, 96)}<rect x="316" y="56" width="42" height="56" rx="10" stroke="${p.primary}" stroke-width="2.5" fill="${p.pale}"/><path d="M328 78 L337 68 L346 78" stroke="${p.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${bar(328, 90, 18, p.deep, 9)}${bar(372, 62, 98, p.line, 10)}${bar(372, 80, 76, p.line)}${bar(372, 96, 54, p.line)}
    ${card(30, 284, 190, 78)}<path d="M52 304 V344" stroke="${p.deep}" stroke-width="3" stroke-linecap="round"/><path d="M52 306 H84 L78 316 L84 326 H52 Z" fill="${p.primary}"/>${bar(100, 308, 94, p.line, 10)}${bar(100, 326, 60, p.line)}<rect x="100" y="342" width="70" height="14" rx="7" fill="${p.mint}"/>
    ${card(310, 292, 180, 72)}<circle cx="344" cy="328" r="20" fill="${p.mint}"/><circle cx="344" cy="322" r="7" fill="${p.secondary}"/><path d="M331 340 C 334 331, 354 331, 357 340" fill="${p.secondary}"/>${bar(376, 314, 92, p.line, 10)}${bar(376, 332, 62, p.line)}
  `);
}

const SHADOW = (p: Palette) => `<ellipse cx="120" cy="140" rx="70" ry="9" fill="${p.mint}"/>`;
const BLOB = (p: Palette) => `<circle cx="120" cy="78" r="62" fill="${p.pale}"/><circle cx="120" cy="78" r="62" stroke="${p.mint}" stroke-width="2"/>`;
const sparkle = (x: number, y: number, p: Palette) => `<path d="M${x} ${y - 6} V${y + 6} M${x - 6} ${y} H${x + 6}" stroke="${p.secondary}" stroke-width="2.5" stroke-linecap="round"/>`;
const W = 3;

export const spots = {
  search: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}${sparkle(176, 40, p)}${sparkle(60, 56, p)}<circle cx="112" cy="72" r="32" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}"/><path d="M136 96 L160 120" stroke="${p.deep}" stroke-width="7" stroke-linecap="round"/>${leaf(112, 90, 0.62, 20, p.secondary)}<circle cx="170" cy="100" r="3" fill="${p.primary}"/>`),
  launches: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}${sparkle(178, 50, p)}${sparkle(58, 92, p)}<path d="M120 32 C 142 52, 146 84, 140 108 L 100 108 C 94 84, 98 52, 120 32 Z" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}" stroke-linejoin="round"/><circle cx="120" cy="72" r="10" fill="${p.mint}" stroke="${p.deep}" stroke-width="${W}"/><path d="M101 92 L82 114 L102 110 Z M139 92 L158 114 L138 110 Z" fill="${p.primary}" stroke="${p.deep}" stroke-width="${W}" stroke-linejoin="round"/><path d="M110 112 Q120 140 130 112 Z" fill="${p.secondary}" stroke="${p.deep}" stroke-width="2" stroke-linejoin="round"/>`),
  startups: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}${sparkle(178, 56, p)}<rect x="84" y="62" width="72" height="76" rx="5" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}"/>${[0, 1, 2].map((r) => [0, 1].map((c) => `<rect x="${96 + c * 28}" y="${74 + r * 17}" width="14" height="10" rx="2" fill="${p.mint}" stroke="${p.deep}" stroke-width="1.5"/>`).join("")).join("")}<rect x="112" y="116" width="16" height="22" rx="2" fill="${p.primary}"/><path d="M120 62 V44" stroke="${p.deep}" stroke-width="${W}" stroke-linecap="round"/>${leaf(120, 50, 0.5, -40, p.secondary)}${leaf(120, 50, 0.5, 40, p.primary)}<path d="M64 138 H176" stroke="${p.deep}" stroke-width="${W}" stroke-linecap="round"/>`),
  notifications: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}${sparkle(62, 52, p)}<path d="M120 42 C 96 42, 90 64, 90 86 L 82 106 L 158 106 L 150 86 C 150 64, 144 42, 120 42 Z" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}" stroke-linejoin="round"/><circle cx="120" cy="36" r="5" fill="${p.deep}"/><path d="M110 112 C 112 122, 128 122, 130 112" stroke="${p.deep}" stroke-width="${W}" stroke-linecap="round"/><circle cx="148" cy="52" r="9" fill="${p.primary}" stroke="${p.white}" stroke-width="3"/>`),
  opportunities: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}${sparkle(176, 44, p)}<rect x="116" y="34" width="8" height="104" rx="3" fill="${p.deep}"/><path d="M124 46 H168 L180 58 L168 70 H124 Z" fill="${p.primary}" stroke="${p.deep}" stroke-width="${W}" stroke-linejoin="round"/><path d="M116 80 H72 L60 92 L72 104 H116 Z" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}" stroke-linejoin="round"/>${bar(132, 54, 30, "#fff", 6)}${bar(72, 88, 32, p.mint, 6)}<circle cx="120" cy="34" r="6" fill="${p.deep}"/>`),
  inbox: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}${sparkle(60, 50, p)}<rect x="68" y="52" width="104" height="70" rx="9" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}"/><path d="M70 58 L120 98 L170 58" stroke="${p.deep}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"/>${leaf(156, 56, 0.5, 20, p.secondary)}`),
  team: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}<path d="M120 74 L80 108 M120 74 L160 108 M80 108 H160" stroke="${p.primary}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>${[[120, 70, 20], [80, 108, 15], [160, 108, 15]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}"/><circle cx="${x}" cy="${(y ?? 0) - (r ?? 0) * 0.2}" r="${(r ?? 0) * 0.38}" fill="${p.secondary}"/><path d="M${(x ?? 0) - (r ?? 0) * 0.6} ${(y ?? 0) + (r ?? 0) * 0.62} C ${(x ?? 0) - (r ?? 0) * 0.4} ${(y ?? 0) + (r ?? 0) * 0.1}, ${(x ?? 0) + (r ?? 0) * 0.4} ${(y ?? 0) + (r ?? 0) * 0.1}, ${(x ?? 0) + (r ?? 0) * 0.6} ${(y ?? 0) + (r ?? 0) * 0.62}" fill="${p.secondary}"/>`).join("")}${sparkle(176, 44, p)}`),
  saved: (p: Palette) => svg("0 0 240 160", `${SHADOW(p)}${BLOB(p)}${sparkle(170, 46, p)}${sparkle(66, 94, p)}<path d="M92 38 H148 V124 L120 104 L92 124 Z" fill="${p.white}" stroke="${p.deep}" stroke-width="${W}" stroke-linejoin="round"/>${leaf(120, 88, 0.62, 0, p.secondary)}`),
} as const;
export type SpotName = keyof typeof spots;
