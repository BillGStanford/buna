import { describe, expect, it } from "vitest";
import { buildOpportunityHref, DEFAULT_OPPORTUNITY_PARAMS, deadlineState, describeDeadline, hasActiveOpportunityFilters, parseOpportunityParams } from "./opportunities/params";
import { buildFounderHref, DEFAULT_FOUNDER_PARAMS, parseFounderParams, parseInvestorParams, buildInvestorHref, DEFAULT_INVESTOR_PARAMS } from "./people/params";
import { contactSchema, countLinks, deleteAccountSchema, inquirySchema, inviteSchema, inviteTokenSchema, investorSchema, memberRoleSchema, opportunitySchema } from "./validation/network";
import { signUpSchema } from "./validation/auth";
import { CSS_PALETTE, HEX_PALETTE, heroArt, logoLockup, logoMark, spots } from "./art";

const ID = "11111111-1111-4111-8111-111111111111";

describe("opportunity params", () => {
  it("defaults to open opportunities sorted by deadline", () => expect(parseOpportunityParams({})).toEqual(DEFAULT_OPPORTUNITY_PARAMS));
  it("accepts valid values and drops hostile ones", () => {
    expect(parseOpportunityParams({ q: " grant ", category: "grant", country: "et", when: "soon", sort: "newest", page: "2" })).toEqual({ q: "grant", category: "grant", country: "ET", when: "soon", sort: "newest", page: 2 });
    expect(parseOpportunityParams({ category: "grant;drop", country: "ZZ", when: "forever", sort: "x", page: "-3" })).toEqual(DEFAULT_OPPORTUNITY_PARAMS);
  });
  it("builds short, canonical links", () => {
    expect(buildOpportunityHref({})).toBe("/opportunities");
    expect(buildOpportunityHref({ when: "closed", page: 2 })).toBe("/opportunities?when=closed&page=2");
    expect(hasActiveOpportunityFilters({ ...DEFAULT_OPPORTUNITY_PARAMS, page: 5 })).toBe(false);
    expect(hasActiveOpportunityFilters({ ...DEFAULT_OPPORTUNITY_PARAMS, when: "soon" })).toBe(true);
  });
});

describe("deadlineState — expired listings are never presented as open", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("rolling when there is no deadline", () => expect(deadlineState("published", null, now)).toEqual({ kind: "rolling" }));
  it("open with a day count", () => {
    expect(deadlineState("published", "2026-10-23T12:00:00Z", now)).toEqual({ kind: "open", daysLeft: 3 });
    expect(describeDeadline({ kind: "open", daysLeft: 1 })).toBe("Closes within a day");
    expect(describeDeadline({ kind: "open", daysLeft: 9 })).toBe("9 days left");
  });
  it("closed when the date has passed even if the stored status still says published", () => {
    expect(deadlineState("published", "2026-10-19T12:00:00Z", now)).toEqual({ kind: "closed" });
    expect(deadlineState("published", "garbage", now)).toEqual({ kind: "closed" });
  });
  it("closed when expired or archived regardless of deadline", () => {
    expect(deadlineState("expired", null, now)).toEqual({ kind: "closed" });
    expect(deadlineState("archived", "2027-01-01T00:00:00Z", now)).toEqual({ kind: "closed" });
    expect(describeDeadline({ kind: "closed" })).toBe("Closed");
  });
});

describe("founder and investor params", () => {
  it("normalise and clamp", () => {
    expect(parseFounderParams({})).toEqual(DEFAULT_FOUNDER_PARAMS);
    expect(parseFounderParams({ q: "ab", country: "et", interest: "Fintech", expertise: "Payments", openTo: "mentoring", page: "3" })).toMatchObject({ country: "ET", interest: "fintech", expertise: "payments", openTo: "mentoring", page: 3 });
    expect(parseFounderParams({ openTo: "stealing", interest: "a b", country: "ZZ" })).toEqual(DEFAULT_FOUNDER_PARAMS);
    expect(buildFounderHref({ q: "x&y", page: 2 })).toBe("/founders?q=x%26y&page=2");
    expect(parseInvestorParams({ stage: "mvp", sector: "Fintech", country: "ke" })).toMatchObject({ stage: "mvp", sector: "fintech", country: "KE" });
    expect(parseInvestorParams({ stage: "unicorn" })).toEqual(DEFAULT_INVESTOR_PARAMS);
    expect(buildInvestorHref({ stage: "idea" })).toBe("/investors?stage=idea");
  });
});

describe("network schemas", () => {
  it("opportunity: requires a source to publish, rejects unsafe links, parses UTC dates", () => {
    const base = { opportunityId: "", title: "Seed Grant", organization: "Org", description: "", category: "grant", eligibility: "", countries: ["et"], deadline: "2026-11-01T09:30", applicationUrl: "", sourceUrl: "https://src.example", publishedDate: "", status: "published", tags: "Funding, Seed", markChecked: false };
    const ok = opportunitySchema.safeParse(base);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ countries: ["ET"], deadline: "2026-11-01T09:30:00.000Z", tags: ["funding", "seed"], opportunityId: null });
    expect(opportunitySchema.safeParse({ ...base, sourceUrl: "" }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, status: "draft", sourceUrl: "" }).success).toBe(true);
    expect(opportunitySchema.safeParse({ ...base, applicationUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, countries: ["ZZ"] }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, deadline: "next week" }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, category: "lottery" }).success).toBe(false);
  });
  it("investor: validates stages, links and verification values", () => {
    const base = { investorId: "", name: "Fund", description: "", websiteUrl: "", country: "ke", regions: "East Africa, West Africa", stages: ["mvp"], sectors: ["fintech"], thesis: "", contactUrl: "", verificationStatus: "unverified", isPublished: true };
    expect(investorSchema.safeParse(base).success).toBe(true);
    expect(investorSchema.safeParse({ ...base, stages: ["moon"] }).success).toBe(false);
    expect(investorSchema.safeParse({ ...base, contactUrl: "data:text/html,x" }).success).toBe(false);
    expect(investorSchema.safeParse({ ...base, verificationStatus: "gold" }).success).toBe(false);
  });
  it("inquiry: counts links, caps them, validates fields", () => {
    expect(countLinks("see https://a.co and www.b.co and http://c.co")).toBe(3);
    const base = { startupId: ID, name: "Sam", email: " SAM@Example.com ", category: "customer", subject: "Hello", message: "A message long enough to send." };
    const r = inquirySchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("sam@example.com");
    expect(inquirySchema.safeParse({ ...base, message: "short" }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...base, message: "buy https://a.co https://b.co https://c.co https://d.co now" }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...base, category: "sales" }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...base, startupId: "x" }).success).toBe(false);
    expect(contactSchema.safeParse({ name: "A", email: "a@b.co", topic: "privacy", message: "Please delete my data." }).success).toBe(true);
    expect(contactSchema.safeParse({ name: "A", email: "a@b.co", topic: "spam", message: "Please delete my data." }).success).toBe(false);
  });
  it("team schemas never allow inviting an owner", () => {
    expect(inviteSchema.safeParse({ startupId: ID, email: "a@b.co", role: "editor" }).success).toBe(true);
    expect(inviteSchema.safeParse({ startupId: ID, email: "a@b.co", role: "owner" }).success).toBe(false);
    expect(memberRoleSchema.safeParse({ startupId: ID, userId: ID, role: "viewer" }).success).toBe(true);
    expect(memberRoleSchema.safeParse({ startupId: ID, userId: ID, role: "god" }).success).toBe(false);
  });
  it("invitation tokens must be 43 url-safe characters", () => {
    expect(inviteTokenSchema.safeParse("A".repeat(43)).success).toBe(true);
    expect(inviteTokenSchema.safeParse("A".repeat(42)).success).toBe(false);
    expect(inviteTokenSchema.safeParse("../" + "A".repeat(40)).success).toBe(false);
  });
  it("account deletion needs the username and password", () => {
    expect(deleteAccountSchema.safeParse({ confirmUsername: " Pia ", password: "x" })).toMatchObject({ success: true, data: { confirmUsername: "pia" } });
    expect(deleteAccountSchema.safeParse({ confirmUsername: "", password: "x" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmUsername: "pia", password: "" }).success).toBe(false);
  });
  it("signup requires accepting the terms", () => {
    const base = { displayName: "Abebe", email: "a@b.co", password: "correct-horse-1", confirmPassword: "correct-horse-1" };
    expect(signUpSchema.safeParse(base).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, acceptTerms: "on" }).success).toBe(true);
  });
});

describe("artwork", () => {
  const all = [logoMark(HEX_PALETTE), logoLockup(HEX_PALETTE), logoLockup(HEX_PALETTE, true), heroArt(HEX_PALETTE), ...Object.values(spots).map((f) => f(HEX_PALETTE))];
  it("produces well-formed, script-free SVG", () => {
    for (const svg of all) {
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg.trim().endsWith("</svg>")).toBe(true);
      expect(svg).not.toMatch(/<script|onload=|onerror=|javascript:|<foreignObject/i);
      expect((svg.match(/<g[\s>]/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
    }
  });
  it("themeable variant only references the design-token variables", () => {
    const themed = heroArt(CSS_PALETTE);
    expect(themed).toContain("rgb(var(--primary))");
    expect(themed).not.toMatch(/#087F5B/i);
  });
  it("includes every illustration used by empty states", () => {
    expect(Object.keys(spots).sort()).toEqual(["inbox", "launches", "notifications", "opportunities", "saved", "search", "startups", "team"]);
  });
});
