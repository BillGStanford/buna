import { z } from "zod";
import { countryField, httpUrl, optionalHttpUrl, optionalText } from "./common";
import { STAGES, LINK_KINDS, REPORT_REASONS } from "@/lib/startups/constants";
import { isValidSlug } from "@/lib/slug";
import { tagList } from "./profile";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidField = z.string().regex(UUID, "Invalid id.");

const categoryId = z
  .string()
  .refine((v) => v === "" || UUID.test(v), "Choose a sector from the list.")
  .transform((v) => (v === "" ? null : v));

const stage = z
  .string()
  .refine((v) => v === "" || STAGES.some((s) => s.value === v), "Choose a stage from the list.")
  .transform((v) => (v === "" ? null : v));

const foundedYear = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= new Date().getFullYear() + 1), "Enter a four-digit year.")
  .transform((v) => (v === "" ? null : Number(v)));

const amountForStartup = z.string().trim().regex(/^$|^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount.").transform((v) => v ? Number(v) : null);

const name = z.string().trim().min(2, "Enter the startup’s name.").max(80, "Use 80 characters or fewer.");

export const createStartupSchema = z.object({
  name,
  tagline: optionalText(160),
  categoryId,
  country: countryField,
  city: optionalText(80),
});

export const updateStartupSchema = z.object({
  startupId: uuidField,
  name,
  tagline: optionalText(160),
  description: optionalText(5000),
  problemStatement: optionalText(3000),
  solution: optionalText(3000),
  targetCustomers: z.string().max(1000).transform((v) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 12)),
  targetGeographies: z.string().max(1000).transform((v) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 12)),
  marketOpportunity: optionalText(3000),
  businessModel: optionalText(80),
  fundingRound: z.enum(["", "pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "debt", "grant", "other"]),
  fundraisingStatus: z.enum(["not_raising", "raising", "open_to_conversations", "closed"]),
  fundingTarget: amountForStartup,
  fundingCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  websiteUrl: optionalHttpUrl,
  country: countryField,
  city: optionalText(80),
  categoryId,
  stage,
  foundedYear,
  tags: tagList,
});

export const slugSchema = z.object({
  startupId: uuidField,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidSlug, "Use 3–60 lowercase letters, numbers and single dashes. Some words are reserved."),
});

export const productSchema = z.object({
  startupId: uuidField,
  productId: z.union([uuidField, z.literal("")]).transform((v) => (v === "" ? null : v)),
  name: z.string().trim().min(1, "Enter the product name.").max(80, "Use 80 characters or fewer."),
  description: optionalText(1000),
  url: optionalHttpUrl,
});

export const linkSchema = z.object({
  startupId: uuidField,
  kind: z.string().refine((v) => LINK_KINDS.some((k) => k.value === v), "Choose a link type."),
  url: httpUrl,
  label: optionalText(40),
});

export const galleryAltSchema = z.object({
  startupId: uuidField,
  altText: z.string().trim().min(3, "Describe the image in a few words (for screen readers).").max(200, "Use 200 characters or fewer."),
});

export const reportSchema = z.object({
  targetType: z.enum(["startup", "launch", "comment", "user", "opportunity", "investor"]),
  targetId: uuidField,
  reason: z.string().refine((v) => REPORT_REASONS.some((r) => r.value === v), "Choose a reason."),
  details: optionalText(1000),
});

export const publicationSchema = z.object({
  startupId: uuidField,
  publish: z.enum(["true", "false"]).transform((v) => v === "true"),
});
