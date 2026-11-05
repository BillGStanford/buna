"use server";

import { moderateCommunityThreadAction as moderate } from "@/app/community/actions";

export async function moderateCommunityThreadAction(formData: FormData): Promise<void> {
  await moderate(formData);
}
