import { z } from "zod";
import { httpUrl, optionalHttpUrl, optionalText } from "./common";
import { uuidField } from "./startup";
import { normalizeTags } from "@/lib/launches/params";
import { LAUNCH_LIMITS } from "@/lib/launches/constants";

const optionalUuid = z
  .string()
  .refine((v) => v === "" || uuidField.safeParse(v).success, "Choose from the list.")
  .transform((v) => (v === "" ? null : v));

const tags = z
  .string()
  .max(300)
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
  .refine((arr) => arr.length <= LAUNCH_LIMITS.tags, `Add up to ${LAUNCH_LIMITS.tags} tags.`)
  .refine((arr) => arr.every((t) => t.length <= 30), "Keep each tag under 30 characters.")
  .transform((arr) => normalizeTags(arr.join(","), LAUNCH_LIMITS.tags));

const launchDate = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    const days = (d.getTime() - Date.now()) / 86400000;
    return days > -1 && days < 366;
  }, "Choose a date from today up to a year ahead.")
  .transform((v) => (v === "" ? null : v));

const base = {
  name: z.string().trim().min(2, "Enter the product name.").max(80, "Use 80 characters or fewer."),
  tagline: z.string().trim().min(5, "Describe it in at least 5 characters.").max(160, "Use 160 characters or fewer."),
  productUrl: httpUrl,
  description: optionalText(5000),
  startupId: optionalUuid,
  categoryId: optionalUuid,
  tags,
  launchDate,
  demoVideoUrl: optionalHttpUrl,
};

export const createLaunchSchema = z.object({
  ...base,
  confirm: z.literal("on", { errorMap: () => ({ message: "Please confirm before continuing." }) }),
});

export const updateLaunchSchema = z.object({ launchId: uuidField, ...base });

export const launchIdSchema = z.object({ launchId: uuidField });

export const launchAltSchema = z.object({
  launchId: uuidField,
  altText: z.string().trim().min(3, "Describe the image in a few words (for screen readers).").max(200, "Use 200 characters or fewer."),
});

export const voteSchema = z.object({ launchId: uuidField });

const commentBody = z.string().trim().min(1, "Write something first.").max(2000, "Comments can be up to 2,000 characters.");

export const createCommentSchema = z.object({
  launchId: uuidField,
  parentId: z.union([uuidField, z.literal("")]).transform((v) => (v === "" ? null : v)),
  body: commentBody,
});
export const editCommentSchema = z.object({ commentId: uuidField, body: commentBody });
export const commentIdSchema = z.object({ commentId: uuidField });

export const followSchema = z.object({
  targetType: z.enum(["startup", "user"]),
  targetId: uuidField,
  intent: z.enum(["follow", "unfollow"]),
});

export const REPORT_TARGETS = ["startup", "launch", "comment", "user"] as const;
export const moderationSchema = z.object({
  launchId: uuidField,
  action: z.enum(["approve", "reject", "remove", "feature", "unfeature"]),
  note: optionalText(500),
});

export const notificationPrefsSchema = z.object({
  emailComments: z.boolean(),
  emailReplies: z.boolean(),
  emailModeration: z.boolean(),
});
