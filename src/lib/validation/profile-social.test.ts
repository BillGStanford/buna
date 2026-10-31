import { describe, expect, it } from "vitest";
import { profileSchema } from "./profile";

const validProfile = {
  displayName: "A Founder",
  username: "founder_01",
  headline: "",
  bio: "",
  country: "",
  city: "",
  professionalRole: "",
  founderStatus: "",
  websiteUrl: "",
  socialLinkedin: "",
  socialX: "",
  socialGithub: "",
  socialInstagram: "",
  socialYoutube: "",
  socialTiktok: "",
  socialFacebook: "",
  socialThreads: "",
  interests: [],
  expertise: "",
  openTo: [],
  isPublicProfile: true,
  showLocation: false,
  isDiscoverableFounder: false,
};

describe("profile social links", () => {
  it("accepts supported social profile URLs", () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      socialLinkedin: "https://www.linkedin.com/in/founder",
      socialX: "https://x.com/founder",
      socialGithub: "https://github.com/founder",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a URL that does not belong to the selected platform", () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      socialLinkedin: "https://attacker.example/founder",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unsafe URL schemes", () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      socialGithub: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("allows users to clear social links", () => {
    const result = profileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.socialGithub).toBeNull();
  });
});
