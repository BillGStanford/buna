import { z } from "zod";
import { uuidField } from "@/lib/validation/startup";

export const createCommunityThreadSchema = z.object({
  category: z.enum(["founder-networking", "hiring-talent", "investor-questions", "legal-registration", "feedback"]),
  title: z.string().trim().min(8, "Use at least 8 characters.").max(140),
  body: z.string().trim().min(20, "Add a little more context (at least 20 characters).").max(5000),
});

export const createCommunityReplySchema = z.object({
  threadId: uuidField,
  body: z.string().trim().min(1).max(3000),
});

export const communitySubscriptionSchema = z.object({ threadId: uuidField });
export const moderateCommunityThreadSchema = z.object({
  threadId: uuidField,
  status: z.enum(["published", "hidden", "deleted"]),
});
export const moderateCommunityReplySchema = z.object({
  replyId: uuidField,
  status: z.enum(["published", "hidden", "deleted"]),
});
