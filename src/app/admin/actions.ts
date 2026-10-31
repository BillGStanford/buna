"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { categorySchema, commentModerationSchema, resolveReportSchema, revokeVerificationSchema, roleSchema, settingSchema, startupModerationSchema, suspensionSchema, verificationReviewSchema } from "@/lib/validation/admin";
import type { ActionState } from "@/lib/types";

const log = createLogger("admin");
const BAD: ActionState = { status: "error", message: "Check the form and try again." };

function explain(message: string): string {
  if (message.includes("note_required")) return "A note is required for this decision — the affected person may see it.";
  if (message.includes("invalid_state")) return "That action doesn’t apply to the item’s current state.";
  if (message.includes("forbidden")) return "You don’t have permission to do that.";
  if (message.includes("not_found")) return "That item no longer exists.";
  if (message.includes("duplicate key")) return "That slug is already in use.";
  return "We couldn’t apply that. Please try again.";
}

async function rpc(name: string, args: Record<string, unknown>, ok: string, paths: string[]): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (!/note_required|invalid_state|forbidden|not_found/.test(error.message)) log.error(`${name} failed`, error, { code: error.code });
    return { status: "error", message: explain(error.message) };
  }
  for (const p of paths) revalidatePath(p, "layout");
  revalidatePath("/", "layout");
  return { status: "success", message: typeof data === "string" && data ? `${ok} (${data.replace("_", " ")})` : ok };
}

export async function moderateStartupAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff();
  const r = startupModerationSchema.safeParse(formDataToObject(fd));
  if (!r.success) return BAD;
  return rpc("moderate_startup", { p_startup: r.data.startupId, p_action: r.data.action, p_note: r.data.note }, "Done", ["/admin/startups", "/admin/featured", "/startups"]);
}

export async function moderateCommentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff();
  const r = commentModerationSchema.safeParse(formDataToObject(fd));
  if (!r.success) return BAD;
  return rpc("moderate_comment", { p_comment: r.data.commentId, p_action: r.data.action, p_note: r.data.note }, "Done", ["/admin/reports", "/launches"]);
}

export async function resolveReportAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff();
  const r = resolveReportSchema.safeParse(formDataToObject(fd));
  if (!r.success) return BAD;
  return rpc("resolve_report", { p_report: r.data.reportId, p_status: r.data.status, p_note: r.data.note }, "Report updated", ["/admin/reports", "/admin"]);
}

export async function suspendUserAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireStaff();
  const r = suspensionSchema.safeParse(formDataToObject(fd));
  if (!r.success) return BAD;
  return rpc("set_user_suspension", { p_user: r.data.userId, p_suspended: r.data.suspended, p_reason: r.data.reason }, r.data.suspended ? "Account suspended" : "Account reinstated", ["/admin/users"]);
}

export async function setUserRoleAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const r = roleSchema.safeParse(formDataToObject(fd));
  if (!r.success) return BAD;
  return rpc("set_user_role", { p_user: r.data.userId, p_role: r.data.role }, "Role updated", ["/admin/users"]);
}

export async function reviewVerificationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const r = verificationReviewSchema.safeParse(formDataToObject(fd));
  if (!r.success) return BAD;
  return rpc("review_verification", { p_request: r.data.requestId, p_decision: r.data.decision, p_note: r.data.note }, "Decision recorded", ["/admin/verification", "/startups"]);
}

export async function revokeVerificationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const r = revokeVerificationSchema.safeParse(formDataToObject(fd));
  if (!r.success) return { status: "error", fieldErrors: flattenErrors(r.error) };
  return rpc("revoke_verification", { p_startup: r.data.startupId, p_note: r.data.note }, "Verification withdrawn", ["/admin/verification", "/startups"]);
}

export async function setSettingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const r = settingSchema.safeParse(formDataToObject(fd));
  if (!r.success) return BAD;
  return rpc("set_platform_setting", { p_key: r.data.key, p_value: r.data.value }, "Setting saved", ["/admin/settings"]);
}

export async function saveCategoryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const raw = formDataToObject(fd);
  const r = categorySchema.safeParse({ ...raw, isActive: fd.get("isActive") === "on" });
  if (!r.success) return { status: "error", fieldErrors: flattenErrors(r.error), message: "Check the highlighted fields." };
  const d = r.data;
  const supabase = await createClient();
  const row = { name: d.name, slug: d.slug, description: d.description, sort_order: d.sortOrder, is_active: d.isActive };
  const q = d.categoryId ? supabase.from("categories").update(row).eq("id", d.categoryId).select("id").maybeSingle() : supabase.from("categories").insert(row).select("id").maybeSingle();
  const { data, error } = await q;
  if (error) {
    if (error.code === "23505") return { status: "error", fieldErrors: { slug: ["That slug is already used by another category."] } };
    log.error("save category failed", error);
    return { status: "error", message: "We couldn’t save the category." };
  }
  if (!data) return { status: "error", message: "We couldn’t save the category." };
  await writeAuditLog({ actorId: admin.id, action: d.categoryId ? "category.update" : "category.create", entityType: "category", entityId: String(data.id), metadata: { slug: d.slug, active: d.isActive } });
  revalidatePath("/", "layout");
  return { status: "success", message: d.categoryId ? "Category saved." : "Category created.", values: d.categoryId ? undefined : {} };
}
