"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { dispatchNotificationEmails } from "@/lib/notifications/dispatch";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { moderationSchema } from "@/lib/validation/launch";
import type { ActionState } from "@/lib/types";

const log = createLogger("moderation");

function moderationError(message: string): string {
  if (message.includes("note_required")) return "Add a note explaining what needs to change — the maker will see it.";
  if (message.includes("invalid_state")) return "That action doesn’t apply to this launch’s current status.";
  if (message.includes("forbidden")) return "Only moderators and admins can do that.";
  if (message.includes("not_found")) return "That launch no longer exists.";
  return "We couldn’t apply that decision. Please try again.";
}

/** Staff decision on a launch. The database function re-checks the role, applies the change, notifies the maker and writes the audit log. */
export async function moderateLaunchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = moderationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Check the form and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderate_launch", { p_launch_id: parsed.data.launchId, p_action: parsed.data.action, p_note: parsed.data.note });
  if (error) {
    if (!/note_required|invalid_state|forbidden|not_found/.test(error.message)) log.error("moderate_launch failed", error, { code: error.code });
    return { status: "error", message: moderationError(error.message) };
  }
  revalidatePath("/admin/launches");
  revalidatePath("/launches", "layout");
  after(() => dispatchNotificationEmails().catch((e) => log.error("dispatch failed", e)));
  return { status: "success", message: `Done — launch is now ${String(data).replace("_", " ")}.` };
}
