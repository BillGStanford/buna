import { isKnownCountry } from "@/lib/geo";
import { sanitizeSearchTerm } from "@/lib/startups/params";

export const OPEN_TO = [
  { value: "cofounding", label: "Co-founding" },
  { value: "mentoring", label: "Mentoring" },
  { value: "hiring", label: "Hiring" },
  { value: "investing", label: "Investing" },
  { value: "partnerships", label: "Partnerships" },
  { value: "advice", label: "Giving advice" },
] as const;

export const FOUNDER_PAGE_SIZE = 12;
export type FounderParams = { q: string; country: string; city: string; interest: string; expertise: string; openTo: string; page: number };
export const DEFAULT_FOUNDER_PARAMS: FounderParams = { q: "", country: "", city: "", interest: "", expertise: "", openTo: "", page: 1 };
type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFounderParams(sp: Raw): FounderParams {
  const country = first(sp.country).trim().toUpperCase();
  const interest = first(sp.interest).trim().toLowerCase();
  const openTo = first(sp.openTo).trim();
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: sanitizeSearchTerm(first(sp.q)),
    country: isKnownCountry(country) ? country : "",
    city: sanitizeSearchTerm(first(sp.city), 60),
    interest: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(interest) ? interest : "",
    expertise: sanitizeSearchTerm(first(sp.expertise), 40).toLowerCase(),
    openTo: OPEN_TO.some((o) => o.value === openTo) ? openTo : "",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1,
  };
}
export const hasActiveFounderFilters = (p: FounderParams) => Boolean(p.q || p.country || p.city || p.interest || p.expertise || p.openTo);

export function buildFounderHref(overrides: Partial<FounderParams>, base: FounderParams = DEFAULT_FOUNDER_PARAMS, path = "/founders"): string {
  const p = { ...base, ...overrides };
  const qs = new URLSearchParams();
  for (const k of ["q", "country", "city", "interest", "expertise", "openTo"] as const) if (p[k]) qs.set(k, p[k]);
  if (p.page > 1) qs.set("page", String(p.page));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export const INVESTOR_PAGE_SIZE = 12;
export type InvestorParams = { q: string; stage: string; sector: string; country: string; page: number };
export const DEFAULT_INVESTOR_PARAMS: InvestorParams = { q: "", stage: "", sector: "", country: "", page: 1 };
const STAGE_VALUES = ["idea", "prototype", "mvp", "early_revenue", "growth", "scale"];

export function parseInvestorParams(sp: Raw): InvestorParams {
  const stage = first(sp.stage).trim();
  const sector = first(sp.sector).trim().toLowerCase();
  const country = first(sp.country).trim().toUpperCase();
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: sanitizeSearchTerm(first(sp.q)),
    stage: STAGE_VALUES.includes(stage) ? stage : "",
    sector: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(sector) ? sector : "",
    country: isKnownCountry(country) ? country : "",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1,
  };
}
export const hasActiveInvestorFilters = (p: InvestorParams) => Boolean(p.q || p.stage || p.sector || p.country);
export function buildInvestorHref(overrides: Partial<InvestorParams>, base: InvestorParams = DEFAULT_INVESTOR_PARAMS, path = "/investors"): string {
  const p = { ...base, ...overrides };
  const qs = new URLSearchParams();
  for (const k of ["q", "stage", "sector", "country"] as const) if (p[k]) qs.set(k, p[k]);
  if (p.page > 1) qs.set("page", String(p.page));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
