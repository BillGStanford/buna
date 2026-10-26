import { describe, expect, it } from "vitest";
import { initials, safeRedirectPath } from "./utils";

describe("safeRedirectPath (open-redirect defence)", () => {
  it("allows same-site paths including query strings", () => {
    expect(safeRedirectPath("/dashboard/profile")).toBe("/dashboard/profile");
    expect(safeRedirectPath("/startups?country=ET&page=2")).toBe("/startups?country=ET&page=2");
  });
  it.each([
    "//evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "/\\evil.com",
    "evil.com", "", "/ok\nSet-Cookie: x=1", "/ok\\path",
  ])("rejects %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/dashboard");
  });
  it("handles null/undefined and custom fallback", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath(undefined, "/")).toBe("/");
  });
});

describe("initials", () => {
  it("builds initials", () => {
    expect(initials("Abebe Kebede")).toBe("AK");
    expect(initials("Selam")).toBe("S");
    expect(initials("")).toBe("B");
    expect(initials(null)).toBe("B");
  });
});
