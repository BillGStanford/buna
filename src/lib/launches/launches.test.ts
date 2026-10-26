import { describe, expect, it } from "vitest";
import { buildLaunchHref, DEFAULT_LAUNCH_PARAMS, hasActiveLaunchFilters, normalizeTags, parseLaunchParams, periodSince } from "./params";
import { commentIdSchema, createCommentSchema, createLaunchSchema, editCommentSchema, followSchema, launchAltSchema, moderationSchema, updateLaunchSchema, voteSchema } from "@/lib/validation/launch";
import { formatDate } from "@/lib/format";

const ID = "11111111-1111-4111-8111-111111111111";

describe("parseLaunchParams", () => {
  it("defaults", () => expect(parseLaunchParams({})).toEqual(DEFAULT_LAUNCH_PARAMS));
  it("accepts valid values", () => {
    expect(parseLaunchParams({ sort: "top", q: " pay ", category: "Fintech", tag: "Mobile", period: "week", page: "3" }))
      .toEqual({ sort: "top", q: "pay", category: "fintech", tag: "mobile", period: "week", page: 3 });
  });
  it("drops hostile or unknown values", () => {
    expect(parseLaunchParams({ sort: "random()", category: "a;b", tag: "x y", period: "forever", page: "-1" })).toEqual(DEFAULT_LAUNCH_PARAMS);
    expect(parseLaunchParams({ q: 'x"),id.eq.1' }).q).toBe("x id.eq.1");
  });
});

describe("buildLaunchHref / filters", () => {
  it("omits defaults", () => {
    expect(buildLaunchHref({})).toBe("/launches");
    expect(buildLaunchHref({ sort: "latest", category: "fintech", page: 2 })).toBe("/launches?sort=latest&category=fintech&page=2");
    expect(buildLaunchHref({ page: 1 }, { ...DEFAULT_LAUNCH_PARAMS, q: "a", page: 4 })).toBe("/launches?q=a");
  });
  it("sort and page alone are not 'filters'", () => {
    expect(hasActiveLaunchFilters({ ...DEFAULT_LAUNCH_PARAMS, sort: "top", page: 3 })).toBe(false);
    expect(hasActiveLaunchFilters({ ...DEFAULT_LAUNCH_PARAMS, tag: "x" })).toBe(true);
  });
});

describe("periodSince", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it("computes windows", () => {
    expect(periodSince("all", now)).toBeNull();
    expect(periodSince("day", now)).toBe("2026-10-18T12:00:00.000Z");
    expect(periodSince("week", now)).toBe("2026-10-12T12:00:00.000Z");
  });
});

describe("normalizeTags", () => {
  it("cleans, dedupes and caps tags", () => {
    expect(normalizeTags("Mobile Money, mobile-money , AI/ML,, ")).toEqual(["mobile-money", "ai-ml"]);
    expect(normalizeTags("a,b,c,d,e,f,g").length).toBe(5);
  });
});

describe("launch schemas", () => {
  const good = { name: "Alpha", tagline: "An app for alphas", productUrl: "https://alpha.example", description: "", startupId: "", categoryId: "", tags: "payments, Mobile", launchDate: "", demoVideoUrl: "", confirm: "on" };
  it("accepts and normalises a valid launch", () => {
    const r = createLaunchSchema.safeParse(good);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ tags: ["payments", "mobile"], startupId: null, categoryId: null, launchDate: null, demoVideoUrl: null, description: null });
  });
  it("requires the confirmation checkbox", () => expect(createLaunchSchema.safeParse({ ...good, confirm: "" }).success).toBe(false));
  it("rejects unsafe or malformed input", () => {
    expect(createLaunchSchema.safeParse({ ...good, productUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(createLaunchSchema.safeParse({ ...good, demoVideoUrl: "ftp://x" }).success).toBe(false);
    expect(createLaunchSchema.safeParse({ ...good, tagline: "hey" }).success).toBe(false);
    expect(createLaunchSchema.safeParse({ ...good, tags: "a,b,c,d,e,f" }).success).toBe(false);
    expect(createLaunchSchema.safeParse({ ...good, categoryId: "nope" }).success).toBe(false);
  });
  it("launch dates: today..one year ahead only", () => {
    const iso = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
    expect(createLaunchSchema.safeParse({ ...good, launchDate: iso(0) }).success).toBe(true);
    expect(createLaunchSchema.safeParse({ ...good, launchDate: iso(30) }).success).toBe(true);
    expect(createLaunchSchema.safeParse({ ...good, launchDate: iso(-30) }).success).toBe(false);
    expect(createLaunchSchema.safeParse({ ...good, launchDate: iso(500) }).success).toBe(false);
    expect(createLaunchSchema.safeParse({ ...good, launchDate: "2026-13-45" }).success).toBe(false);
    expect(createLaunchSchema.safeParse({ ...good, launchDate: "tomorrow" }).success).toBe(false);
  });
  it("update schema needs an id (no confirm checkbox)", () => {
    const { confirm: _c, ...rest } = good; void _c;
    expect(updateLaunchSchema.safeParse({ ...rest, launchId: ID }).success).toBe(true);
    expect(updateLaunchSchema.safeParse({ ...rest, launchId: "x" }).success).toBe(false);
  });
  it("alt text, votes, comments, follows, moderation", () => {
    expect(launchAltSchema.safeParse({ launchId: ID, altText: "ab" }).success).toBe(false);
    expect(voteSchema.safeParse({ launchId: ID }).success).toBe(true);
    expect(voteSchema.safeParse({ launchId: "1; drop" }).success).toBe(false);
    expect(createCommentSchema.safeParse({ launchId: ID, parentId: "", body: "  hi  " })).toMatchObject({ success: true, data: { body: "hi", parentId: null } });
    expect(createCommentSchema.safeParse({ launchId: ID, parentId: "", body: "   " }).success).toBe(false);
    expect(createCommentSchema.safeParse({ launchId: ID, parentId: "", body: "x".repeat(2001) }).success).toBe(false);
    expect(editCommentSchema.safeParse({ commentId: ID, body: "ok" }).success).toBe(true);
    expect(commentIdSchema.safeParse({ commentId: "nope" }).success).toBe(false);
    expect(followSchema.safeParse({ targetType: "user", targetId: ID, intent: "follow" }).success).toBe(true);
    expect(followSchema.safeParse({ targetType: "table", targetId: ID, intent: "follow" }).success).toBe(false);
    expect(moderationSchema.safeParse({ launchId: ID, action: "approve", note: "" }).success).toBe(true);
    expect(moderationSchema.safeParse({ launchId: ID, action: "delete", note: "" }).success).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats in UTC and tolerates junk", () => {
    expect(formatDate("2026-10-19T23:30:00Z")).toBe("19 Oct 2026");
    expect(formatDate(null)).toBe("");
    expect(formatDate("garbage")).toBe("");
  });
});
