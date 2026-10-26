import { isKnownCountry } from "@/lib/geo";
import { sanitizeSearchTerm } from "@/lib/startups/params";
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_WHEN, type OpportunityWhen } from "./constants";

export type OpportunityParams = { q: string; category: string; country: string; when: OpportunityWhen; sort: "deadline" | "newest"; page: number };
export const DEFAULT_OPPORTUNITY_PARAMS: OpportunityParams = { q: "", category: "", country: "", when: "open", sort: "deadline", page: 1 };

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseOpportunityParams(sp: Raw): OpportunityParams {
  const category = first(sp.category).trim();
  const country = first(sp.country).trim().toUpperCase();
  const when = first(sp.when).trim();
  const page = Number.parseInt(first(sp.page), 10);
  return {
    q: sanitizeSearchTerm(first(sp.q)),
    category: OPPORTUNITY_CATEGORIES.some((c) => c.value === category) ? category : "",
    country: isKnownCountry(country) ? country : "",
    when: OPPORTUNITY_WHEN.some((w) => w.value === when) ? (when as OpportunityWhen) : "open",
    sort: first(sp.sort) === "newest" ? "newest" : "deadline",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1,
  };
}

export const hasActiveOpportunityFilters = (p: OpportunityParams) => Boolean(p.q || p.category || p.country || p.when !== "open" || p.sort !== "deadline");

export function buildOpportunityHref(overrides: Partial<OpportunityParams>, base: OpportunityParams = DEFAULT_OPPORTUNITY_PARAMS, path = "/opportunities"): string {
  const p = { ...base, ...overrides };
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.category) qs.set("category", p.category);
  if (p.country) qs.set("country", p.country);
  if (p.when !== "open") qs.set("when", p.when);
  if (p.sort !== "deadline") qs.set("sort", p.sort);
  if (p.page > 1) qs.set("page", String(p.page));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export type DeadlineState = { kind: "rolling" } | { kind: "open"; daysLeft: number } | { kind: "closed" };

/** A listing is only ever "open" if it is published and its deadline hasn't passed — whatever the stored status says. */
export function deadlineState(status: string, deadline: string | null, now: Date = new Date()): DeadlineState {
  if (status === "expired" || status === "archived") return { kind: "closed" };
  if (!deadline) return { kind: "rolling" };
  const ms = new Date(deadline).getTime() - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return { kind: "closed" };
  return { kind: "open", daysLeft: Math.ceil(ms / 86_400_000) };
}

export function describeDeadline(state: DeadlineState): string {
  if (state.kind === "rolling") return "Rolling — no deadline";
  if (state.kind === "closed") return "Closed";
  return state.daysLeft <= 1 ? "Closes within a day" : `${state.daysLeft} days left`;
}
