"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { uuidField } from "@/lib/validation/startup";
import type { ActionState } from "@/lib/types";

const log = createLogger("notification-actions");
const refresh = () => revalidatePath("/", "layout");

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await requireUser("/dashboard/notifications");
  const id = uuidField.safeParse(formData.get("notificationId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", user.id).is("read_at", null);
  refresh();
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser("/dashboard/notifications");
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  refresh();
}

export async function savePreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/notifications");
  const supabase = await createClient();
  const { data, error } = await supabase.from("notification_preferences").update({
    email_comments: formData.get("emailComments") === "on",
    email_replies: formData.get("emailReplies") === "on",
    email_moderation: formData.get("emailModeration") === "on",
  }).eq("user_id", user.id).select("user_id").maybeSingle();
  if (error || !data) {
    log.error("save preferences failed", error);
    return { status: "error", message: "We couldn’t save your preferences. Please try again." };
  }
  revalidatePath("/dashboard/notifications");
  return { status: "success", message: "Preferences saved." };
}
