// Regenerates Buna's static brand assets from src/lib/art.ts (single source of truth).
//   npm run assets      (needs Node 22.6+ for --experimental-strip-types, and the @resvg/resvg-js dev dependency)
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { HEX_PALETTE as P, heroArt, logoLockup, logoMark, spots } from "../../src/lib/art.ts";

const out = (path, data) => { writeFileSync(path, data); console.log("wrote", path); };
const png = (svg, width, bg) => new Resvg(svg, { fitTo: { mode: "width", value: width }, background: bg, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync("public/icons", { recursive: true });
mkdirSync("public/illustrations", { recursive: true });
mkdirSync("docs/brand", { recursive: true });

// logos
out("public/logo-mark.svg", logoMark(P));
out("public/logo.svg", logoLockup(P));
out("public/logo-light.svg", logoLockup(P, true));

// app icons (full-bleed mark on brand green for maskable, rounded for the rest)
const mark = logoMark(P);
out("public/icons/icon-192.png", png(mark, 192));
out("public/icons/icon-512.png", png(mark, 512));
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${P.primary}"/><g transform="translate(16 16) scale(.72) translate(-16 -16)"><g transform="rotate(35 16 16)"><ellipse cx="16" cy="16" rx="6.6" ry="10" fill="#fff"/><path d="M16 6.6c-3.6 4.6 3.6 9.2 0 14.4" stroke="${P.primary}" stroke-width="1.9" stroke-linecap="round" fill="none"/></g></g></svg>`;
out("public/icons/maskable-512.png", png(maskable, 512));
out("src/app/apple-icon.png", png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${P.primary}"/><g transform="translate(16 16) scale(.78) translate(-16 -16)"><g transform="rotate(35 16 16)"><ellipse cx="16" cy="16" rx="6.6" ry="10" fill="#fff"/><path d="M16 6.6c-3.6 4.6 3.6 9.2 0 14.4" stroke="${P.primary}" stroke-width="1.9" stroke-linecap="round" fill="none"/></g></g></svg>`, 180));

// favicon.ico: PNG-compressed 32 and 48 px images in an ICO container
const imgs = [32, 48].map((s) => ({ s, data: png(mark, s) }));
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
let offset = 6 + imgs.length * 16;
const entries = imgs.map(({ s, data }) => {
  const e = Buffer.alloc(16); e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
  offset += data.length; return e;
});
out("src/app/favicon.ico", Buffer.concat([header, ...entries, ...imgs.map((i) => i.data)]));

// illustrations as standalone SVG files (for email, docs and design tools) + PNG previews for review
out("public/illustrations/hero.svg", heroArt(P));
for (const [name, fn] of Object.entries(spots)) out(`public/illustrations/${name}.svg`, fn(P));
out("docs/brand/hero-preview.png", png(heroArt(P), 1040, "#FFFFFF"));
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 360" fill="none"><rect width="960" height="360" fill="#fff"/>${Object.values(spots).map((fn, i) => `<g transform="translate(${(i % 4) * 240} ${Math.floor(i / 4) * 180})">${fn(P).replace("<svg ", '<svg x="0" y="0" width="240" height="160" ')}</g>`).join("")}</svg>`;
out("docs/brand/illustrations-preview.png", png(sheet, 1440, "#FFFFFF"));
out("docs/brand/logo-preview.png", png(logoLockup(P), 560, "#FFFFFF"));
