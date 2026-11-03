import { z } from "zod";
import { emailField, optionalHttpUrl, optionalText } from "./common";
import { uuidField } from "./startup";
import { STAGES } from "@/lib/startups/constants";

const csv = (maxItems: number, maxLength = 500) => z.string().max(maxLength).transform((v) =>
  [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, maxItems)
);
const amount = z.string().trim().regex(/^$|^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount.").transform((v) => v ? Number(v) : null);

export const investorApplicationSchema = z.object({
  existingInvestorId: z.union([uuidField, z.literal("")]).transform((v) => v || null),
  organizationName: z.string().trim().min(2).max(120),
  investorType: z.enum(["angel", "venture_capital", "accelerator", "investment_fund", "corporate", "family_office", "development_finance", "other"]),
  websiteUrl: optionalHttpUrl,
  contactEmail: z.preprocess((v) => v === "" ? undefined : v, emailField.optional()),
  contactPhone: optionalText(40),
  whatsapp: optionalText(120),
  facebook: optionalText(200),
  telegram: optionalText(120),
  background: z.string().trim().min(20).max(3000),
  sectors: csv(15).transform((v) => v.map((x) => x.toLowerCase().replace(/\s+/g, "-"))),
  stages: csv(6).refine((v) => v.every((x) => STAGES.some((s) => s.value === x)), "Choose valid investment stages."),
  markets: csv(8),
  investmentMin: amount,
  investmentMax: amount,
  investmentCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  portfolio: optionalText(3000),
  proofUrl: optionalHttpUrl,
}).refine((d) => !!(d.contactEmail || d.contactPhone || d.whatsapp || d.facebook || d.telegram), {
  path: ["contactEmail"], message: "Provide at least one contact method: email, phone, WhatsApp, Facebook, or Telegram.",
}).refine((d) => d.investmentMin === null || d.investmentMax === null || d.investmentMax >= d.investmentMin, {
  path: ["investmentMax"], message: "Maximum must be greater than or equal to minimum.",
});

export const investorSubmissionSchema = z.object({
  investorId: uuidField,
  startupId: z.union([uuidField, z.literal("")]).transform((v) => v || null),
  submissionType: z.enum(["introduction", "pitch"]),
  startupName: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(30).max(3000),
  stage: z.enum(["idea", "prototype", "mvp", "early_revenue", "growth", "scale"]).or(z.literal("")),
  fundingAmount: amount,
  fundingCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  fitReason: z.string().trim().min(10).max(1500),
  pitchDeckUrl: optionalHttpUrl,
});

export const investorSubmissionUpdateSchema = z.object({
  submissionId: uuidField,
  status: z.enum(["new", "under_review", "interested", "meeting_requested", "in_discussion", "declined", "closed"]),
  investorResponse: optionalText(2000),
});
export const investorMessageSchema = z.object({
  submissionId: uuidField,
  body: z.string().trim().min(1).max(4000),
});
export const investorApplicationReviewSchema = z.object({
  applicationId: uuidField,
  decision: z.enum(["approve", "reject"]),
  note: optionalText(500),
});

export const investorProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(3000),
  websiteUrl: optionalHttpUrl,
  contactUrl: optionalHttpUrl,
  investorType: z.enum(["angel", "venture_capital", "accelerator", "investment_fund", "corporate", "family_office", "development_finance", "other"]),
  regions: csv(8),
  sectors: csv(15).transform((v) => v.map((x) => x.toLowerCase().replace(/\s+/g, "-"))),
  stages: csv(6).refine((v) => v.every((x) => STAGES.some((s) => s.value === x)), "Choose valid investment stages."),
  investmentMin: amount,
  investmentMax: amount,
  investmentCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  portfolio: optionalText(3000),
  thesis: optionalText(3000),
  contactEmail: z.preprocess((v) => v === "" ? undefined : v, emailField.optional()),
  contactPhone: optionalText(40),
  whatsapp: optionalText(120),
  facebook: optionalText(200),
  telegram: optionalText(120),
  background: z.string().trim().min(20).max(3000),
}).refine((d) => !!(d.contactEmail || d.contactPhone || d.whatsapp || d.facebook || d.telegram), {
  path: ["contactEmail"], message: "Provide at least one contact method: email, phone, WhatsApp, Facebook, or Telegram.",
}).refine((d) => d.investmentMin === null || d.investmentMax === null || d.investmentMax >= d.investmentMin, {
  path: ["investmentMax"], message: "Maximum must be greater than or equal to minimum.",
});
