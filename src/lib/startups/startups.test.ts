import { describe, expect, it } from "vitest";
import {
  buildDirectoryHref, DEFAULT_PARAMS, hasActiveFilters, paginationWindow, parseDirectoryParams, sanitizeSearchTerm,
} from "./params";
import { publishReadiness } from "./readiness";
import {
  createStartupSchema, galleryAltSchema, linkSchema, productSchema, publicationSchema, reportSchema, slugSchema, updateStartupSchema,
} from "@/lib/validation/startup";

const ID = "11111111-1111-4111-8111-111111111111";

describe("sanitizeSearchTerm", () => {
  it("removes characters that could alter a PostgREST filter or LIKE pattern", () => {
    expect(sanitizeSearchTerm('foo,bar) or id.eq.1 "x" 100% *')).toBe("foo bar or id.eq.1 x 100");
    expect(sanitizeSearchTerm("a_b\\c")).toBe("a b c");
  });
  it("collapses whitespace and caps the length", () => {
    expect(sanitizeSearchTerm("   many    spaces  ")).toBe("many spaces");
    expect(sanitizeSearchTerm("x".repeat(500)).length).toBe(80);
  });
});

describe("parseDirectoryParams", () => {
  it("returns defaults for empty input", () => {
    expect(parseDirectoryParams({})).toEqual(DEFAULT_PARAMS);
  });
  it("accepts valid values and normalises case", () => {
    const p = parseDirectoryParams({ q: " pay ", country: "et", category: "Fintech", stage: "mvp", sort: "name", page: "3", city: "Addis" });
    expect(p).toMatchObject({ q: "pay", country: "ET", category: "fintech", stage: "mvp", sort: "name", page: 3, city: "Addis" });
  });
  it("drops unknown or hostile values instead of passing them on", () => {
    const p = parseDirectoryParams({ country: "ZZ", category: "x;drop table", stage: "unicorn", sort: "price", page: "-4" });
    expect(p).toEqual(DEFAULT_PARAMS);
  });
  it("clamps page numbers and handles repeated keys", () => {
    expect(parseDirectoryParams({ page: "99999" }).page).toBe(1000);
    expect(parseDirectoryParams({ page: "abc" }).page).toBe(1);
    expect(parseDirectoryParams({ q: ["first", "second"] }).q).toBe("first");
  });
});

describe("buildDirectoryHref / hasActiveFilters", () => {
  it("omits defaults and preserves everything else", () => {
    expect(buildDirectoryHref({})).toBe("/startups");
    expect(buildDirectoryHref({ q: "pay", country: "ET", page: 2 })).toBe("/startups?q=pay&country=ET&page=2");
    expect(buildDirectoryHref({ page: 1 }, { ...DEFAULT_PARAMS, q: "pay", page: 5 })).toBe("/startups?q=pay");
  });
  it("encodes user text", () => {
    expect(buildDirectoryHref({ q: "a&b=c" })).toBe("/startups?q=a%26b%3Dc");
  });
  it("detects active filters but not pagination alone", () => {
    expect(hasActiveFilters(DEFAULT_PARAMS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, page: 4 })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, stage: "idea" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, sort: "name" })).toBe(true);
  });
});

describe("paginationWindow", () => {
  it("lists every page when there are few", () => expect(paginationWindow(2, 5)).toEqual([1, 2, 3, 4, 5]));
  it("adds ellipses for long ranges", () => {
    expect(paginationWindow(1, 20)).toEqual([1, 2, "…", 20]);
    expect(paginationWindow(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(paginationWindow(20, 20)).toEqual([1, "…", 19, 20]);
  });
});

describe("publishReadiness", () => {
  it("lists what is missing", () => {
    const r = publishReadiness({ name: "A", tagline: " ", description: null, category_id: null, country: "" });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.key)).toEqual(["tagline", "description", "category", "country"]);
  });
  it("is ready when complete", () => {
    expect(publishReadiness({ tagline: "t", description: "d", category_id: ID, country: "ET" }).ready).toBe(true);
  });
});

describe("startup schemas", () => {
  it("create: name required, optional fields normalised", () => {
    const r = createStartupSchema.safeParse({ name: "Alpha", tagline: "", categoryId: "", country: "et", city: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ tagline: null, categoryId: null, country: "ET", city: null });
    expect(createStartupSchema.safeParse({ name: "A", tagline: "", categoryId: "", country: "", city: "" }).success).toBe(false);
  });
  it("update: validates ids, year, stage, website and tags", () => {
    const base = { startupId: ID, name: "Alpha", tagline: "x", description: "y", problemStatement: "The problem", solution: "Our solution", targetCustomers: "SMEs, banks", targetGeographies: "Ethiopia, Kenya", marketOpportunity: "Growing market", businessModel: "SaaS", fundingRound: "seed", fundraisingStatus: "raising", fundingTarget: "250000", fundingCurrency: "USD", websiteUrl: "", country: "ET", city: "", categoryId: ID, stage: "mvp", foundedYear: "2024", tags: "a, b" };
    const ok = updateStartupSchema.safeParse(base);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ foundedYear: 2024, tags: ["a", "b"], websiteUrl: null, targetCustomers: ["SMEs", "banks"], targetGeographies: ["Ethiopia", "Kenya"], fundingTarget: 250000, fundingCurrency: "USD", fundraisingStatus: "raising" });
    expect(updateStartupSchema.safeParse({ ...base, startupId: "nope" }).success).toBe(false);
    expect(updateStartupSchema.safeParse({ ...base, foundedYear: "1800" }).success).toBe(false);
    expect(updateStartupSchema.safeParse({ ...base, stage: "unicorn" }).success).toBe(false);
    expect(updateStartupSchema.safeParse({ ...base, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(updateStartupSchema.safeParse({ ...base, tagline: "x".repeat(161) }).success).toBe(false);
    expect(updateStartupSchema.safeParse({ ...base, fundingTarget: "-50" }).success).toBe(false);
    expect(updateStartupSchema.safeParse({ ...base, fundingRound: "unicorn" }).success).toBe(false);
  });
  it("slug: normalises and rejects reserved or malformed slugs", () => {
    expect(slugSchema.safeParse({ startupId: ID, slug: " Alpha-Labs " }).success).toBe(true);
    for (const slug of ["admin", "a", "bad slug", "-x-", "x--y"]) {
      expect(slugSchema.safeParse({ startupId: ID, slug }).success).toBe(false);
    }
  });
  it("product and link schemas reject unsafe URLs", () => {
    expect(productSchema.safeParse({ startupId: ID, productId: "", name: "App", description: "", url: "https://x.co" }).success).toBe(true);
    expect(productSchema.safeParse({ startupId: ID, productId: "", name: "App", description: "", url: "javascript:1" }).success).toBe(false);
    expect(linkSchema.safeParse({ startupId: ID, kind: "github", url: "https://github.com/x", label: "" }).success).toBe(true);
    expect(linkSchema.safeParse({ startupId: ID, kind: "github", url: "data:text/html,x", label: "" }).success).toBe(false);
    expect(linkSchema.safeParse({ startupId: ID, kind: "nope", url: "https://x.co", label: "" }).success).toBe(false);
  });
  it("report schema accepts only known target types", () => {
    expect(reportSchema.safeParse({ targetType: "comment", targetId: ID, reason: "abusive", details: "" }).success).toBe(true);
    expect(reportSchema.safeParse({ targetType: "database", targetId: ID, reason: "spam", details: "" }).success).toBe(false);
  });
  it("gallery alt text, report and publication schemas", () => {
    expect(galleryAltSchema.safeParse({ startupId: ID, altText: "ab" }).success).toBe(false);
    expect(galleryAltSchema.safeParse({ startupId: ID, altText: "Dashboard screenshot" }).success).toBe(true);
    expect(reportSchema.safeParse({ targetType: "startup", targetId: ID, reason: "spam", details: "" }).success).toBe(true);
    expect(reportSchema.safeParse({ targetType: "startup", targetId: ID, reason: "boring", details: "" }).success).toBe(false);
    expect(publicationSchema.parse({ startupId: ID, publish: "true" }).publish).toBe(true);
    expect(publicationSchema.safeParse({ startupId: ID, publish: "maybe" }).success).toBe(false);
  });
});
