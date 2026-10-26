import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "./auth";
import { onboardingSchema, profileSchema } from "./profile";
import { formDataToObject, httpUrl, optionalHttpUrl } from "./common";

describe("auth schemas", () => {
  const good = { displayName: "Abebe K", email: " ABEBE@Example.com ", password: "correct-horse-1", confirmPassword: "correct-horse-1", acceptTerms: "on" };
  it("normalises email and accepts valid signups", () => {
    const r = signUpSchema.safeParse(good);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("abebe@example.com");
  });
  it("requires accepting the terms", () => {
    const { acceptTerms: _a, ...rest } = good; void _a;
    expect(signUpSchema.safeParse(rest).success).toBe(false);
  });
  it("rejects short passwords, mismatches and bad emails", () => {
    expect(signUpSchema.safeParse({ ...good, password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, confirmPassword: "different-one-1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, email: "nope" }).success).toBe(false);
  });
  it("rejects passwords over 72 characters (bcrypt limit)", () => {
    const long = "a".repeat(73);
    expect(resetPasswordSchema.safeParse({ password: long, confirmPassword: long }).success).toBe(false);
  });
  it("sign-in and forgot-password basics", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});

describe("url validation", () => {
  it.each(["https://example.com", "http://example.com/path?x=1"])("accepts %s", (u) => {
    expect(httpUrl.safeParse(u).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "example.com", "file:///etc/passwd"])("rejects %s", (u) => {
    expect(httpUrl.safeParse(u).success).toBe(false);
  });
  it("optional url turns empty into null", () => {
    expect(optionalHttpUrl.parse("")).toBeNull();
  });
});

describe("profile schemas", () => {
  const base = {
    displayName: "Selam T", username: "Selam_T", headline: "", bio: "", country: "et", city: "", professionalRole: "",
    founderStatus: "", websiteUrl: "", interests: [], openTo: [], expertise: "payments, growth ,", isPublicProfile: true,
    showLocation: false, isDiscoverableFounder: true,
  };
  it("normalises username, country and expertise", () => {
    const r = profileSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.username).toBe("selam_t");
      expect(r.data.country).toBe("ET");
      expect(r.data.expertise).toEqual(["payments", "growth"]);
      expect(r.data.headline).toBeNull();
    }
  });
  it("blocks the reserved user- prefix and bad usernames", () => {
    expect(profileSchema.safeParse({ ...base, username: "user-abc123" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, username: "a" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, username: "bad name" }).success).toBe(false);
  });
  it("founder directory requires a public profile", () => {
    expect(profileSchema.safeParse({ ...base, isPublicProfile: false, isDiscoverableFounder: true }).success).toBe(false);
  });
  it("rejects unknown countries, javascript: websites and oversized bios", () => {
    expect(profileSchema.safeParse({ ...base, country: "XX" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, bio: "x".repeat(501) }).success).toBe(false);
  });
  it("onboarding accepts minimal input", () => {
    const r = onboardingSchema.safeParse({ displayName: "Dawit", username: "dawit", country: "", city: "", professionalRole: "", founderStatus: "", startupIntent: "", interests: [] });
    expect(r.success).toBe(true);
  });
  it("limits interests to 10", () => {
    const interests = Array.from({ length: 11 }, (_, i) => `cat-${i}`);
    expect(onboardingSchema.safeParse({ displayName: "Dawit", username: "dawit", country: "", city: "", professionalRole: "", founderStatus: "", startupIntent: "", interests }).success).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("collects repeated keys into arrays and ignores Next internals", () => {
    const fd = new FormData();
    fd.append("interests", "fintech"); fd.append("interests", "edtech"); fd.append("name", "x"); fd.append("$ACTION_ID_abc", "1");
    const o = formDataToObject(fd, ["interests", "missing"]);
    expect(o.interests).toEqual(["fintech", "edtech"]);
    expect(o.missing).toEqual([]);
    expect(o.name).toBe("x");
    expect("$ACTION_ID_abc" in o).toBe(false);
  });
});
