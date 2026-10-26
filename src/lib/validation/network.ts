import { z } from "zod";
import { countryField, emailField, optionalHttpUrl, optionalText } from "./common";
import { uuidField } from "./startup";
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_STATUSES } from "@/lib/opportunities/constants";
import { OPEN_TO } from "@/lib/people/params";
import { isKnownCountry } from "@/lib/geo";
import { STAGES } from "@/lib/startups/constants";

// ---------- opportunities (admin) ----------
const countries = z
  .array(z.string().trim().toUpperCase())
  .max(60)
  .refine((arr) => arr.every(isKnownCountry), "Choose countries from the list.");

const dateTimeUtc = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}:00Z`).getTime()), "Use the date and time picker.")
  .transform((v) => (v === "" ? null : new Date(`${v}:00Z`).toISOString()));

const dateOnly = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())), "Use the date picker.")
  .transform((v) => (v === "" ? null : v));

const tagCsv = z.string().max(300).transform((v) => v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 8));

export const opportunitySchema = z.object({
  opportunityId: z.union([uuidField, z.literal("")]).transform((v) => (v === "" ? null : v)),
  title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(140, "Use 140 characters or fewer."),
  organization: z.string().trim().min(2, "Enter the organisation.").max(120),
  description: optionalText(5000),
  category: z.string().refine((v) => OPPORTUNITY_CATEGORIES.some((c) => c.value === v), "Choose a category."),
  eligibility: optionalText(2000),
  countries,
  deadline: dateTimeUtc,
  applicationUrl: optionalHttpUrl,
  sourceUrl: optionalHttpUrl,
  publishedDate: dateOnly,
  status: z.string().refine((v) => OPPORTUNITY_STATUSES.some((s) => s.value === v), "Choose a status."),
  tags: tagCsv,
  markChecked: z.boolean(),
}).refine((d) => d.status !== "published" || Boolean(d.sourceUrl), { path: ["sourceUrl"], message: "Add the source link before publishing, so visitors can verify the listing." });

export const opportunityIdSchema = z.object({ opportunityId: uuidField });
export const opportunityStatusSchema = z.object({ opportunityId: uuidField, status: z.enum(["published", "expired", "archived", "draft"]) });
export const saveOpportunitySchema = z.object({ opportunityId: uuidField, intent: z.enum(["save", "unsave"]) });

// ---------- investors (admin) ----------
export const investorSchema = z.object({
  investorId: z.union([uuidField, z.literal("")]).transform((v) => (v === "" ? null : v)),
  name: z.string().trim().min(2, "Enter the organisation name.").max(120),
  description: optionalText(3000),
  websiteUrl: optionalHttpUrl,
  country: countryField,
  regions: z.string().max(300).transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8)),
  stages: z.array(z.string()).refine((a) => a.every((s) => STAGES.some((x) => x.value === s)), "Choose stages from the list."),
  sectors: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).max(15),
  thesis: optionalText(3000),
  contactUrl: optionalHttpUrl,
  verificationStatus: z.enum(["unverified", "pending", "verified", "rejected", "revoked"]),
  isPublished: z.boolean(),
});

// ---------- inquiries ----------
export const INQUIRY_CATEGORIES = [
  { value: "general", label: "General question" },
  { value: "customer", label: "I’m interested as a customer" },
  { value: "partnership", label: "Partnership" },
  { value: "investment", label: "Investment" },
  { value: "hiring", label: "Hiring or joining" },
  { value: "press", label: "Press" },
  { value: "other", label: "Something else" },
] as const;

const URL_RE = /https?:\/\/|www\./gi;
export const countLinks = (text: string) => (text.match(URL_RE) ?? []).length;

export const inquirySchema = z.object({
  startupId: uuidField,
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: emailField,
  category: z.string().refine((v) => INQUIRY_CATEGORIES.some((c) => c.value === v), "Choose a topic."),
  subject: z.string().trim().min(3, "Add a short subject.").max(150),
  message: z.string().trim().min(10, "Write at least a sentence.").max(4000, "Messages can be up to 4,000 characters.")
    .refine((m) => countLinks(m) <= 3, "Please include at most three links."),
});

export const inquiryStatusSchema = z.object({ inquiryId: uuidField, status: z.enum(["new", "read", "replied", "archived", "spam"]) });

export const CONTACT_TOPICS = [
  { value: "general", label: "General question" },
  { value: "support", label: "Help with my account" },
  { value: "report", label: "Report a problem or content" },
  { value: "privacy", label: "Privacy or my data" },
  { value: "partnership", label: "Partnership" },
  { value: "press", label: "Press" },
] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: emailField,
  topic: z.string().refine((v) => CONTACT_TOPICS.some((c) => c.value === v), "Choose a topic."),
  message: z.string().trim().min(10, "Write at least a sentence.").max(4000).refine((m) => countLinks(m) <= 3, "Please include at most three links."),
});

// ---------- team ----------
export const inviteSchema = z.object({ startupId: uuidField, email: emailField, role: z.enum(["admin", "editor", "viewer"]) });
export const memberRoleSchema = z.object({ startupId: uuidField, userId: uuidField, role: z.enum(["owner", "admin", "editor", "viewer"]) });
export const memberRefSchema = z.object({ startupId: uuidField, userId: uuidField });
export const invitationRefSchema = z.object({ startupId: uuidField, invitationId: uuidField });
export const teamVisibilitySchema = z.object({ startupId: uuidField, isPublic: z.boolean(), publicTitle: optionalText(80) });
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid invitation link.");

// ---------- account ----------
export const deleteAccountSchema = z.object({
  confirmUsername: z.string().trim().toLowerCase().min(1, "Type your username to confirm."),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const founderOpenTo = z.array(z.string()).refine((a) => a.every((v) => OPEN_TO.some((o) => o.value === v)), "Choose from the list.");
