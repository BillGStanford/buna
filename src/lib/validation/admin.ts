import { z } from "zod";
import { optionalText as optionalTextStrict } from "./common";

/** Admin forms that offer no note field post no `note` key at all; treat that as an empty note. */
const optionalText = (max: number) => z.preprocess((v) => (v === undefined || v === null ? "" : v), optionalTextStrict(max));
import { uuidField } from "./startup";

export const startupModerationSchema = z.object({ startupId: uuidField, action: z.enum(["approve", "reject", "unpublish", "remove", "restore", "feature", "unfeature"]), note: optionalText(500) });
export const commentModerationSchema = z.object({ commentId: uuidField, action: z.enum(["hide", "restore"]), note: optionalText(500) });
export const resolveReportSchema = z.object({ reportId: uuidField, status: z.enum(["reviewing", "actioned", "dismissed"]), note: optionalText(500) });
export const suspensionSchema = z.object({ userId: uuidField, suspended: z.enum(["true", "false"]).transform((v) => v === "true"), reason: optionalText(300) });
export const roleSchema = z.object({ userId: uuidField, role: z.enum(["user", "moderator", "admin"]) });
export const verificationReviewSchema = z.object({ requestId: uuidField, decision: z.enum(["approve", "reject"]), note: optionalText(500) });
export const revokeVerificationSchema = z.object({ startupId: uuidField, note: z.string().trim().min(3, "Say why the badge is being withdrawn.").max(500) });
export const settingSchema = z.object({ key: z.enum(["startups_require_review", "launches_require_review"]), value: z.enum(["true", "false"]).transform((v) => v === "true") });
export const categorySchema = z.object({
  categoryId: z.union([uuidField, z.literal("")]).transform((v) => (v === "" ? null : v)),
  name: z.string().trim().min(2, "Enter a name.").max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes.").max(60),
  description: optionalText(200),
  sortOrder: z.string().trim().regex(/^\d{1,4}$/, "Enter a number from 0 to 9999.").transform(Number),
  isActive: z.boolean(),
});
export const verificationRequestSchema = z.object({ startupId: uuidField, notes: z.string().trim().min(10, "Tell us how we can check this (at least a sentence).").max(2000) });
