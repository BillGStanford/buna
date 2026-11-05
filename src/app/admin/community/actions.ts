"use server";

import { moderateCommunityReplyAction as moderateReply, moderateCommunityThreadAction as moderateThread } from "@/app/community/actions";

export async function moderateCommunityThreadAction(formData: FormData): Promise<void> {
  await moderateThread(formData);
}

export async function moderateCommunityReplyAction(formData: FormData): Promise<void> {
  await moderateReply(formData);
}
