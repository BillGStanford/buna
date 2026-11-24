import { describe, expect, it } from "vitest";
import { getFounderPathProfileValues } from "./founder-path";

describe("founder onboarding profile values", () => {
  it.each([
    ["new", "founder", "create"],
    ["existing", "founder", "join"],
    ["invite", "team_member", "join"],
    ["exploring", "explorer", "none"],
  ] as const)("maps %s to values accepted by profiles constraints", (path, founderStatus, startupIntent) => {
    expect(getFounderPathProfileValues(path)).toEqual({ founderStatus, startupIntent });
    expect(["founder", "cofounder_seeking", "team_member", "investor", "mentor", "explorer"]).toContain(founderStatus);
    expect(["create", "join", "none"]).toContain(startupIntent);
  });
});
