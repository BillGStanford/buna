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


/** Save launch competition controls. Database constraints and RLS enforce the same limits. */
export async function saveLaunchPlatformSettingsAction(formData: FormData): Promise<void> {
  const { requireAdmin } = await import("@/lib/auth/session");
  const { redirect } = await import("next/navigation");
  await requireAdmin();
  const mode = String(formData.get("publishingMode") ?? "");
  const duration = Number(formData.get("competitionHours"));
  const lead = Number(formData.get("scheduleLeadHours"));
  if (!["instant", "review"].includes(mode) || !Number.isInteger(duration) || duration < 1 || duration > 72 || !Number.isInteger(lead) || lead < 0 || lead > 720) {
    throw new Error("Invalid settings. Competition duration must be 1–72 hours and scheduling notice 0–720 hours.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("launch_platform_config").update({
    publishing_mode: mode, competition_duration_hours: duration, schedule_min_lead_hours: lead,
    updated_at: new Date().toISOString(),
  }).eq("id", true);
  if (error) {
    log.error("launch platform settings update failed", error, { code: error.code });
    throw new Error("Could not save launch settings. Confirm migration 0024 has been applied.");
  }
  const setting = await supabase.rpc("set_platform_setting", { p_key: "launches_require_review", p_value: mode === "review" });
  if (setting.error) {
    log.error("legacy review setting sync failed", setting.error);
    throw new Error("The new settings saved, but the legacy review setting did not synchronize. Refresh and retry.");
  }
  revalidatePath("/admin/launches", "layout");
  revalidatePath("/admin/settings", "page");
  revalidatePath("/launches", "layout");
  redirect("/admin/launches/settings?saved=1");
}
