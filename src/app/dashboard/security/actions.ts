"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { notifySecurityEvent } from "@/lib/notifications/create";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { resetPasswordSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/lib/types";

const log = createLogger("security");

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/security");
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", fieldErrors: { password: ["Choose a password you haven’t used before."] } };
    if (error.code === "weak_password") return { status: "error", fieldErrors: { password: ["Choose a stronger password — avoid common words and patterns."] } };
    log.error("password change failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t update your password. If you signed in a while ago, sign in again and retry." };
  }
  await writeAuditLog({ actorId: user.id, action: "auth.password_change", entityType: "user", entityId: user.id });
  await notifySecurityEvent(user.id, "Your password was changed", "If this wasn’t you, reset your password right away and sign out other devices.");
  return { status: "success", message: "Password updated." };
}

export async function signOutOtherSessionsAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser("/dashboard/security");
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    log.error("sign out others failed", error);
    return { status: "error", message: "We couldn’t sign out your other devices. Please try again." };
  }
  await writeAuditLog({ actorId: user.id, action: "auth.sign_out_others", entityType: "user", entityId: user.id });
  return { status: "success", message: "Signed out of all other devices." };
}
