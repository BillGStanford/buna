export type FounderPath = "new" | "invite" | "exploring";

export type FounderPathProfileValues = {
  founderStatus: "founder" | "team_member" | "explorer";
  startupIntent: "create" | "join" | "none";
};

/**
 * Maps onboarding choices to the canonical values accepted by the profiles
 * table CHECK constraints. User-entered labels belong in onboarding_data,
 * never in these constrained columns.
 */
export function getFounderPathProfileValues(path: FounderPath): FounderPathProfileValues {
  switch (path) {
    case "new":
      return { founderStatus: "founder", startupIntent: "create" };
    case "invite":
      return { founderStatus: "team_member", startupIntent: "join" };
    case "exploring":
      return { founderStatus: "explorer", startupIntent: "none" };
  }
}
