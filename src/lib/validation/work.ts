import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const url = z.string().trim().optional().or(z.literal("")).refine((v) => !v || /^https?:\/\//i.test(v), "Enter a valid http(s) URL.");
const tags = (maxItems: number) => z.string().trim().transform((v) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))])
  .refine((v) => v.length > 0 && v.length <= maxItems, `Enter between 1 and ${maxItems} comma-separated skills.`)
  .refine((v) => v.every((x) => x.length <= 40), "Each skill must be 40 characters or fewer.");

export const workProfileSchema = z.object({
  headline: text(5,120),
  bio: text(30,3000),
  skills: tags(20),
  languages: z.string().trim().transform((v) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))]).refine((v) => v.length <= 10 && v.every((x) => x.length <= 40)),
  experienceLevel: z.enum(["entry","intermediate","expert"]),
  hourlyRate: z.coerce.number().positive().max(1000000).optional().or(z.literal("")),
  availability: z.enum(["available","limited","unavailable"]),
  portfolioUrl: url,
});

export const workProjectSchema = z.object({
  title: text(8,120),
  summary: text(20,220),
  description: text(80,8000),
  category: text(2,60),
  skills: tags(15),
  budgetMin: z.coerce.number().positive().max(100000000),
  budgetMax: z.coerce.number().positive().max(100000000),
  experienceLevel: z.enum(["entry","intermediate","expert"]),
  workLocation: z.enum(["remote","hybrid","onsite"]),
  country: z.string().trim().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
  deadline: z.string().trim().optional().or(z.literal("")),
  startupId: z.string().uuid().optional().or(z.literal("")),
}).refine((v) => v.budgetMax >= v.budgetMin, { path:["budgetMax"], message:"Maximum budget must be at least the minimum." });

export const workProposalSchema = z.object({
  projectId: z.string().uuid(),
  coverLetter: text(80,3000),
  proposedAmount: z.coerce.number().positive().max(100000000),
  estimatedDays: z.coerce.number().int().min(1).max(365),
  relevantWorkUrl: url,
});

export const workMessageSchema = z.object({
  contractId: z.string().uuid(),
  body: text(1,4000),
  attachmentUrl: url,
  attachmentPath: z.string().trim().optional().or(z.literal("")),
});

export const workReviewSchema = z.object({
  contractId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: text(20,1200),
});

export const workDisputeSchema = z.object({
  contractId: z.string().uuid(),
  reason: text(50,3000),
  evidenceUrl: url,
});
