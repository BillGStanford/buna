export const COMMUNITY_CATEGORIES = [
  { value: "founder-networking", label: "Founder Networking", description: "Meet co-founders, peers and collaborators." },
  { value: "hiring-talent", label: "Hiring & Talent", description: "Find people, teams and professional opportunities." },
  { value: "investor-questions", label: "Investor Questions", description: "Discuss fundraising, investors and introductions." },
  { value: "legal-registration", label: "Legal & Registration", description: "Company formation, compliance and operating questions." },
  { value: "feedback", label: "Feedback", description: "Get constructive feedback on a product, idea or business." },
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number]["value"];
export const communityCategoryLabel = (value: string) =>
  COMMUNITY_CATEGORIES.find((category) => category.value === value)?.label ?? "Community";
