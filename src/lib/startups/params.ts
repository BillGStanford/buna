import { isKnownCountry } from "@/lib/geo";
import { STAGES } from "./constants";

export type DirectorySort = "newest" | "name" | "featured";

export type DirectoryParams = {
  q: string;
  country: string;
  city: string;
  category: string;
  stage: string;
  sort: DirectorySort;
  page: number;
};

export const DEFAULT_PARAMS: DirectoryParams = { q: "", country: "", city: "", category: "", stage: "", sort: "newest", page: 1 };

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Strips characters that have meaning in PostgREST filter strings or SQL LIKE patterns
 * (commas, parentheses, quotes, wildcards, backslashes) so user text can only ever be a plain term.
 */
export function sanitizeSearchTerm(input: string, maxLength = 80): string {
  return input.replace(/[,()%*_"'\\:;<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Turns untrusted query-string values into a safe, normalised DirectoryParams. Unknown values are dropped. */
export function parseDirectoryParams(sp: RawParams): DirectoryParams {
  const country = first(sp.country).trim().toUpperCase();
  const category = first(sp.category).trim().toLowerCase();
  const stage = first(sp.stage).trim();
  const sort = first(sp.sort).trim();
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: sanitizeSearchTerm(first(sp.q)),
    country: isKnownCountry(country) ? country : "",
    city: sanitizeSearchTerm(first(sp.city), 60),
    category: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(category) ? category : "",
    stage: STAGES.some((s) => s.value === stage) ? stage : "",
    sort: sort === "name" || sort === "featured" ? sort : "newest",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1,
  };
}

export function hasActiveFilters(p: DirectoryParams): boolean {
  return Boolean(p.q || p.country || p.city || p.category || p.stage || p.sort !== "newest");
}

/** Builds a /startups URL, leaving out defaults so links stay short and canonical. */
export function buildDirectoryHref(overrides: Partial<DirectoryParams>, base: DirectoryParams = DEFAULT_PARAMS, path = "/startups"): string {
  const p = { ...base, ...overrides };
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.country) qs.set("country", p.country);
  if (p.city) qs.set("city", p.city);
  if (p.category) qs.set("category", p.category);
  if (p.stage) qs.set("stage", p.stage);
  if (p.sort !== "newest") qs.set("sort", p.sort);
  if (p.page > 1) qs.set("page", String(p.page));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** Page numbers to render, with ellipses: always first, last and the current neighbourhood. */
export function paginationWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) out.push("…");
    out.push(n);
  });
  return out;
}
