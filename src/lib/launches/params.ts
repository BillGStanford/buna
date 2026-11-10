import { sanitizeSearchTerm } from "@/lib/startups/params";
import { LAUNCH_PERIODS, LAUNCH_SORTS, type LaunchPeriod, type LaunchSort } from "./constants";

export type LaunchParams = { sort: LaunchSort; q: string; category: string; tag: string; period: LaunchPeriod; page: number };
export const DEFAULT_LAUNCH_PARAMS: LaunchParams = { sort: "today", q: "", category: "", tag: "", period: "all", page: 1 };

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Untrusted query string → safe LaunchParams. Unknown values fall back to defaults. */
export function parseLaunchParams(sp: Raw): LaunchParams {
  const sort = first(sp.sort).trim();
  const period = first(sp.period).trim();
  const category = first(sp.category).trim().toLowerCase();
  const tag = first(sp.tag).trim().toLowerCase();
  const page = Number.parseInt(first(sp.page), 10);
  return {
    sort: LAUNCH_SORTS.some((s) => s.value === sort) ? (sort as LaunchSort) : "today",
    q: sanitizeSearchTerm(first(sp.q)),
    category: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(category) ? category : "",
    tag: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(tag) && tag.length <= 30 ? tag : "",
    period: LAUNCH_PERIODS.some((p) => p.value === period) ? (period as LaunchPeriod) : "all",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1,
  };
}

export function hasActiveLaunchFilters(p: LaunchParams): boolean {
  return Boolean(p.q || p.category || p.tag || p.period !== "all");
}

export function buildLaunchHref(overrides: Partial<LaunchParams>, base: LaunchParams = DEFAULT_LAUNCH_PARAMS, path = "/launches"): string {
  const p = { ...base, ...overrides };
  const qs = new URLSearchParams();
  if (p.sort !== "trending") qs.set("sort", p.sort);
  if (p.q) qs.set("q", p.q);
  if (p.category) qs.set("category", p.category);
  if (p.tag) qs.set("tag", p.tag);
  if (p.period !== "all") qs.set("period", p.period);
  if (p.page > 1) qs.set("page", String(p.page));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** Start of the period filter as an ISO timestamp (null for "any time"). */
export function periodSince(period: LaunchPeriod, now: Date = new Date()): string | null {
  const hours = period === "day" ? 24 : period === "week" ? 24 * 7 : period === "month" ? 24 * 30 : 0;
  return hours === 0 ? null : new Date(now.getTime() - hours * 3600_000).toISOString();
}

/** Tags typed as free text → lowercase slugs, de-duplicated. */
export function normalizeTags(input: string, max = 5): string[] {
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, max);
}
