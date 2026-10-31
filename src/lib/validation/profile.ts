import { z } from "zod";
import { countryField, optionalHttpUrl, optionalText } from "./common";

export const FOUNDER_STATUSES = [
  { value: "founder", label: "I’m building a startup" },
  { value: "cofounder_seeking", label: "I’m looking for a co-founder" },
  { value: "team_member", label: "I work at a startup" },
  { value: "investor", label: "I invest in startups" },
  { value: "mentor", label: "I mentor founders" },
  { value: "explorer", label: "I’m here to discover startups" },
] as const;

export const STARTUP_INTENTS = [
  { value: "create", label: "Create a startup profile" },
  { value: "join", label: "Join an existing startup" },
  { value: "none", label: "Just explore for now" },
] as const;

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{2,29}$/, "Use 3–30 letters, numbers, dashes or underscores, starting with a letter or number.")
  .refine((v) => !v.startsWith("user-"), "Choose your own username (“user-” is reserved).");

const slugList = z
  .array(z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/))
  .max(10, "Choose up to 10.");

const founderStatus = z
  .string()
  .refine((v) => v === "" || FOUNDER_STATUSES.some((s) => s.value === v), "Choose an option from the list.")
  .transform((v) => (v === "" ? null : v));

const startupIntent = z
  .string()
  .refine((v) => v === "" || STARTUP_INTENTS.some((s) => s.value === v), "Choose an option from the list.")
  .transform((v) => (v === "" ? null : v));

/** Comma-separated text → tidy array (used for expertise). */
export const tagList = z
  .string()
  .max(400)
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
  .refine((arr) => arr.length <= 10, "Add up to 10.")
  .refine((arr) => arr.every((s) => s.length <= 40), "Keep each item under 40 characters.");

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name.").max(80, "Use 80 characters or fewer."),
  username: usernameField,
  country: countryField,
  city: optionalText(80),
  professionalRole: optionalText(80),
  founderStatus,
  startupIntent,
  interests: slugList,
});

const socialUrl = optionalHttpUrl.default(null);
const socialHost = (value: string | null, allowed: string[]) => {
  if (!value) return true;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name.").max(80, "Use 80 characters or fewer."),
  username: usernameField,
  headline: optionalText(120),
  bio: optionalText(500),
  country: countryField,
  city: optionalText(80),
  professionalRole: optionalText(80),
  founderStatus,
  websiteUrl: optionalHttpUrl,
  socialLinkedin: socialUrl,
  socialX: socialUrl,
  socialGithub: socialUrl,
  socialInstagram: socialUrl,
  socialYoutube: socialUrl,
  socialTiktok: socialUrl,
  socialFacebook: socialUrl,
  socialThreads: socialUrl,
  interests: slugList,
  expertise: tagList,
  openTo: z.array(z.string()).refine((a) => a.every((v) => ["cofounding", "mentoring", "hiring", "investing", "partnerships", "advice"].includes(v)), "Choose from the list."),
  isPublicProfile: z.boolean(),
  showLocation: z.boolean(),
  isDiscoverableFounder: z.boolean(),
}).refine((d) => !d.isDiscoverableFounder || d.isPublicProfile, {
  path: ["isDiscoverableFounder"],
  message: "Turn on your public profile to be listed in the founder directory.",
}).superRefine((d, ctx) => {
  const checks: [keyof typeof d, string, string[]][] = [
    ["socialLinkedin", "LinkedIn", ["linkedin.com"]],
    ["socialX", "X", ["x.com", "twitter.com"]],
    ["socialGithub", "GitHub", ["github.com"]],
    ["socialInstagram", "Instagram", ["instagram.com"]],
    ["socialYoutube", "YouTube", ["youtube.com", "youtu.be"]],
    ["socialTiktok", "TikTok", ["tiktok.com"]],
    ["socialFacebook", "Facebook", ["facebook.com"]],
    ["socialThreads", "Threads", ["threads.net"]],
  ];
  for (const [field, label, hosts] of checks) {
    const value = d[field];
    if (typeof value === "string" && !socialHost(value, hosts)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `Enter a valid ${label} profile URL.` });
    }
  }
});
