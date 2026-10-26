export const OPPORTUNITY_PAGE_SIZE = 12;

export const OPPORTUNITY_CATEGORIES = [
  { value: "grant", label: "Grants & funding" },
  { value: "accelerator", label: "Accelerators & incubators" },
  { value: "competition", label: "Competitions & challenges" },
  { value: "fellowship", label: "Fellowships & programs" },
  { value: "job", label: "Jobs & internships" },
  { value: "event", label: "Events & pitch competitions" },
  { value: "mentorship", label: "Mentorship" },
  { value: "partnership", label: "Partnerships" },
] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number]["value"];
export const categoryLabel = (v: string) => OPPORTUNITY_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const OPPORTUNITY_WHEN = [
  { value: "open", label: "Open now" },
  { value: "soon", label: "Closing within 14 days" },
  { value: "rolling", label: "Rolling (no deadline)" },
  { value: "closed", label: "Closed" },
] as const;
export type OpportunityWhen = (typeof OPPORTUNITY_WHEN)[number]["value"];

export const OPPORTUNITY_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "expired", label: "Expired" },
  { value: "archived", label: "Archived" },
] as const;
