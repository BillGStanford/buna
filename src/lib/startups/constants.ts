export const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP" },
  { value: "early_revenue", label: "Early revenue" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
] as const;

export type StartupStage = (typeof STAGES)[number]["value"];

export function stageLabel(value: string | null | undefined): string | null {
  return STAGES.find((s) => s.value === value)?.label ?? null;
}

export const LINK_KINDS = [
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "X / Twitter" },
  { value: "github", label: "GitHub" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "telegram", label: "Telegram" },
  { value: "other", label: "Other" },
] as const;

export function linkKindLabel(value: string): string {
  return LINK_KINDS.find((k) => k.value === value)?.label ?? "Link";
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or fake listing" },
  { value: "impersonation", label: "Impersonation" },
  { value: "misleading", label: "Misleading or false claims" },
  { value: "abusive", label: "Abusive or offensive" },
  { value: "illegal", label: "Illegal content" },
  { value: "other", label: "Something else" },
] as const;

export const DIRECTORY_PAGE_SIZE = 12;

export const STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "green" | "warning" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_review: { label: "In review", tone: "warning" },
  published: { label: "Published", tone: "green" },
  unpublished: { label: "Unpublished", tone: "neutral" },
  rejected: { label: "Rejected", tone: "danger" },
  removed: { label: "Removed", tone: "danger" },
};

export const VERIFICATION_LABELS: Record<string, string> = {
  unverified: "Not yet verified by Buna",
  pending: "Verification pending review",
  verified: "Verified by Buna",
  rejected: "Verification was not approved",
  revoked: "Verification was withdrawn",
};

export const LIMITS = { products: 12, links: 10, gallery: 6, tags: 10 } as const;
