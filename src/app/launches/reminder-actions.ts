"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

export async function toggleLaunchReminderAction(formData: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const launchId = String(formData.get("launchId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(launchId)) return;
  if (intent !== "follow" && intent !== "unfollow") return;
  if (!(await rateLimit(`launch-reminder:${profile.id}`, 30, 3600))) return;
  const supabase = await createClient();
  if (intent === "follow") {
    const { error } = await supabase.from("launch_reminders").upsert(
      { launch_id: launchId, user_id: profile.id },
      { onConflict: "launch_id,user_id", ignoreDuplicates: true },
    );
    if (error) throw new Error("Could not save your launch reminder.");
  } else {
    const { error } = await supabase.from("launch_reminders").delete()
      .eq("launch_id", launchId).eq("user_id", profile.id);
    if (error) throw new Error("Could not remove your launch reminder.");
  }
  revalidatePath("/launches");
  revalidatePath("/launches/[slug]", "page");
}
