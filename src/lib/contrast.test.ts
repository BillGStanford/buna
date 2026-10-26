import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// WCAG 2.x contrast for the colour pairs the UI actually uses (tokens come straight from globals.css).
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
const token = (name: string): [number, number, number] => {
  const m = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
  if (!m) throw new Error(`token --${name} not found`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: [number, number, number], b: [number, number, number]) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
const over = (fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] => [0, 1, 2].map((i) => Math.round(fg[i]! * alpha + bg[i]! * (1 - alpha))) as [number, number, number];
const WHITE = token("surface");

const pairs: [string, [number, number, number], [number, number, number]][] = [
  ["ink on white", token("ink"), WHITE],
  ["ink on pale", token("ink"), token("pale")],
  ["ink on mint", token("ink"), token("mint")],
  ["muted on white", token("muted"), WHITE],
  ["muted on pale", token("muted"), token("pale")],
  ["white on primary (buttons)", WHITE, token("primary")],
  ["white on primary-deep (hover)", WHITE, token("primary-deep")],
  ["primary on white (links)", token("primary"), WHITE],
  ["primary on pale", token("primary"), token("pale")],
  ["primary-deep on mint (badges, active tabs)", token("primary-deep"), token("mint")],
  ["primary-deep on white", token("primary-deep"), WHITE],
  ["danger on white", token("danger"), WHITE],
  ["danger on tinted alert", token("danger"), over(token("danger"), 0.1, WHITE)],
  ["warning-text on white (badges)", token("warning-text"), WHITE],
  ["warning-text on tinted badge", token("warning-text"), over(token("warning"), 0.1, WHITE)],
  ["white on danger (destructive buttons)", WHITE, token("danger")],
];

describe("design tokens meet WCAG 2.2 AA text contrast (4.5:1)", () => {
  it.each(pairs)("%s", (_name, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("non-text graphics meet 3:1", () => {
    expect(ratio(token("success"), WHITE)).toBeGreaterThanOrEqual(3);
    expect(ratio(token("primary"), WHITE)).toBeGreaterThanOrEqual(3);
    expect(ratio(token("line"), WHITE)).toBeGreaterThan(1.05); // decorative hairlines only; inputs also have a visible focus ring
  });
});
