import { describe, expect, it } from "vitest";
import { hasChosenUsername, profileCompletion } from "./profile-completion";

const empty = {
  display_name: "", username: "user-1a2b3c4d5e", avatar_url: null, headline: null, bio: null,
  country: null, professional_role: null, founder_status: null, startup_intent: null, interests: [],
};

describe("profileCompletion", () => {
  it("starts near zero with a placeholder username", () => {
    expect(hasChosenUsername("user-1a2b3c4d5e")).toBe(false);
    expect(profileCompletion(empty).percent).toBe(0);
  });
  it("counts all completed profile and signup answers", () => {
    const full = {
      ...empty, display_name: "A B", username: "founder_01", avatar_url: "https://x/y.png",
      country: "ET", founder_status: "founder", startup_intent: "create",
      professional_role: "CEO", interests: ["fintech"], bio: "hi",
    };
    expect(profileCompletion(full).percent).toBe(100);
    expect(profileCompletion({ ...full, bio: "" }).percent).toBe(89);
  });
});
