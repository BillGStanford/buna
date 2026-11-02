import { describe, expect, it } from "vitest";
import { signUpSchema } from "./auth";

const validSignup = {
  displayName: "A Founder",
  email: "founder@example.com",
  password: "a-strong-password-123",
  confirmPassword: "a-strong-password-123",
  country: "ET",
  founderStatus: "founder",
  startupIntent: "create",
  acceptTerms: "on",
};

describe("signup onboarding answers", () => {
  it("accepts and normalizes the existing lightweight onboarding answers", () => {
    const result = signUpSchema.safeParse({ ...validSignup, country: "et" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe("ET");
      expect(result.data.founderStatus).toBe("founder");
      expect(result.data.startupIntent).toBe("create");
    }
  });

  it("allows members to skip optional profile questions", () => {
    const result = signUpSchema.safeParse({
      ...validSignup,
      country: "",
      founderStatus: "",
      startupIntent: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBeNull();
      expect(result.data.founderStatus).toBeNull();
      expect(result.data.startupIntent).toBeNull();
    }
  });

  it("rejects unsupported role and intent values", () => {
    expect(signUpSchema.safeParse({ ...validSignup, founderStatus: "admin" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validSignup, startupIntent: "invest" }).success).toBe(false);
  });

  it("rejects invalid country codes", () => {
    expect(signUpSchema.safeParse({ ...validSignup, country: "XX" }).success).toBe(false);
  });
});
