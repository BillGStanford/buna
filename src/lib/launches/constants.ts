export const LAUNCH_PAGE_SIZE = 12;
export const LAUNCH_LIMITS = { screenshots: 6, tags: 5 } as const;

export const LAUNCH_SORTS = [
  { value: "trending", label: "Trending", hint: "Votes in the last day or two count most" },
  { value: "latest", label: "Latest", hint: "Newest launches first" },
  { value: "top", label: "Top", hint: "Most votes of all time" },
  { value: "featured", label: "Featured", hint: "Picked by the Buna team" },
  { value: "upcoming", label: "Upcoming", hint: "Approved and launching soon" },
] as const;
export type LaunchSort = (typeof LAUNCH_SORTS)[number]["value"];

export const LAUNCH_PERIODS = [
  { value: "all", label: "Any time" },
  { value: "day", label: "Past 24 hours" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
] as const;
export type LaunchPeriod = (typeof LAUNCH_PERIODS)[number]["value"];

export const LAUNCH_STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "green" | "warning" | "danger"; help: string }> = {
  draft: { label: "Draft", tone: "neutral", help: "Only you can see this. Submit it for review when it’s ready." },
  pending_review: { label: "In review", tone: "warning", help: "A moderator is reviewing your launch. You’ll be notified of the decision." },
  scheduled: { label: "Scheduled", tone: "green", help: "Approved. It goes live on its launch date." },
  published: { label: "Live", tone: "green", help: "Visible to everyone and open for votes and comments." },
  rejected: { label: "Needs changes", tone: "danger", help: "A moderator asked for changes. Update it and submit again." },
  removed: { label: "Removed", tone: "danger", help: "This launch was removed by the Buna team." },
};

export const NOTIFICATION_ICONS: Record<string, string> = {
  comment: "comment", reply: "reply", launch_approved: "approved", launch_rejected: "rejected", security: "security",
};
