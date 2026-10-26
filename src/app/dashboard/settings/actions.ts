"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { getPublicEnv, isServiceRoleConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { deleteAccountSchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("account-deletion");

/**
 * Permanently deletes the signed-in account. Requires typing the username and re-entering the password (checked
 * with a throw-away client so the current session is untouched). Companies are never deleted with a person:
 * the database function refuses while the person is the only owner of a startup that has other members.
 */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile("/dashboard/settings");
  const user = await requireUser("/dashboard/settings");
  const parsed = deleteAccountSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  if (parsed.data.confirmUsername !== profile.username.toLowerCase()) return { status: "error", fieldErrors: { confirmUsername: ["That doesn’t match your username."] } };
  if (!isServiceRoleConfigured() || !user.email) return { status: "error", message: "Account deletion isn’t available right now." };
  if (!(await rateLimit(`delete-account:${profile.id}`, 5, 3600))) return { status: "error", message: "Too many attempts. Please wait a few minutes." };

  const env = getPublicEnv();
  const probe = createSupabase(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: pwError } = await probe.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
  if (pwError) return { status: "error", fieldErrors: { password: ["That password isn’t right."] } };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("prepare_account_deletion", { p_user: user.id });
  if (error) { log.error("prepare failed", error); return { status: "error", message: "We couldn’t delete your account. Please try again or contact us." }; }
  const result = data as { blocked: boolean; startups?: { id: string; name: string }[] };
  if (result.blocked) {
    const names = (result.startups ?? []).map((s) => s.name).join(", ");
    return { status: "error", message: `You’re the only owner of ${names}, which still has other team members. Make someone else an owner (or remove the other members) on the team page, then try again.` };
  }

  // best-effort cleanup of the person's uploaded avatars; the database rows are removed with the auth user
  try {
    const { data: files } = await admin.storage.from("avatars").list(user.id);
    if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
  } catch (err) { log.warn("avatar cleanup failed", { message: String(err) }); }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) { log.error("auth delete failed", deleteError); return { status: "error", message: "We couldn’t finish deleting your account. Please try again." }; }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?notice=account_deleted");
}
