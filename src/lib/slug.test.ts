import { describe, expect, it } from "vitest";
import { isValidSlug, slugCandidate, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(slugify("Café Délice & Co.")).toBe("cafe-delice-and-co");
    expect(slugify("  Hello   World!! ")).toBe("hello-world");
  });
  it("returns empty for non-latin names", () => {
    expect(slugify("ቡና")).toBe("");
  });
  it("respects max length without trailing dash", () => {
    const s = slugify("a".repeat(30) + " " + "b".repeat(40), 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("accepts good slugs", () => expect(isValidSlug("alpha-labs")).toBe(true));
  it.each(["ab", "-bad", "bad-", "Bad", "has space", "admin", "api", "a--b"])("rejects %s", (s) => {
    expect(isValidSlug(s)).toBe(false);
  });
});

describe("slugCandidate", () => {
  it("uses the name first, then numbered suffixes", () => {
    expect(slugCandidate("Alpha Labs")).toBe("alpha-labs");
    expect(slugCandidate("Alpha Labs", 1)).toBe("alpha-labs-2");
  });
  it("falls back for names with no latin letters or reserved words", () => {
    expect(slugCandidate("ቡና")).toBe("startup");
    expect(isValidSlug(slugCandidate("Admin"))).toBe(true);
    expect(slugCandidate("Admin")).not.toBe("admin");
  });
});
