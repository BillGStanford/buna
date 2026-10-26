import { describe, expect, it } from "vitest";
import { hasChosenUsername, profileCompletion } from "./profile-completion";

const empty = { display_name: "", username: "user-1a2b3c4d5e", avatar_url: null, headline: null, bio: null, country: null, professional_role: null, interests: [] };

describe("profileCompletion", () => {
  it("starts near zero with a placeholder username", () => {
    expect(hasChosenUsername("user-1a2b3c4d5e")).toBe(false);
    expect(profileCompletion(empty).percent).toBe(0);
  });
  it("counts completed items and reaches 100", () => {
    const full = { ...empty, display_name: "A B", username: "ab", avatar_url: "https://x/y.png", country: "ET", professional_role: "CEO", interests: ["fintech"], bio: "hi" };
    expect(profileCompletion(full).percent).toBe(100);
    expect(profileCompletion({ ...full, bio: "" }).percent).toBe(86);
  });
});
