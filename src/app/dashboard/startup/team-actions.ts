"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { inviteSchema, invitationRefSchema, memberRefSchema, memberRoleSchema, teamVisibilitySchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("team");
const refresh = (id: string) => revalidatePath(`/dashboard/startup/${id}/team`);

function teamError(message: string): string {
  if (message.includes("last_owner")) return "A startup must always have an owner. Make someone else an owner first.";
  if (message.includes("forbidden")) return "You don’t have permission to do that.";
  if (message.includes("already_member")) return "That person is already on the team.";
  if (message.includes("duplicate key")) return "There’s already a pending invitation for that email.";
  if (message.includes("invalid_email")) return "Enter a valid email address.";
  if (message.includes("not_found")) return "That person or invitation no longer exists.";
  if (message.includes("account_suspended")) return "Your account is suspended.";
  return "Something went wrong. Please try again.";
}

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData);
  const values = { email: String(raw.email ?? ""), role: String(raw.role ?? "") };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!(await rateLimit(`invite:${profile.id}`, 20, 86400))) return { status: "error", message: "You’ve sent many invitations today. Please try again tomorrow.", values };

  const token = randomToken();
  const supabase = await createClient();
  // Only the hash is stored; the token exists in the invitee's email and (once) in this response.
  const { error } = await supabase.rpc("create_team_invitation", { p_startup: parsed.data.startupId, p_email: parsed.data.email, p_role: parsed.data.role, p_token_hash: sha256Hex(token) });
  if (error) {
    if (!/forbidden|already_member|duplicate key|invalid_email|account_suspended/.test(error.message)) log.error("invite failed", error, { code: error.code });
    return { status: "error", message: teamError(error.message), values };
  }
  refresh(parsed.data.startupId);

  const { data: startup } = await supabase.from("startups").select("name").eq("id", parsed.data.startupId).maybeSingle();
  const link = `${getSiteUrl()}/invite/${token}`;
  const { html, text } = renderEmail({
    heading: `You’re invited to join ${startup?.name ?? "a startup"} on Buna`,
    paragraphs: [`${profile.display_name || "A teammate"} invited you to join ${startup?.name ?? "their startup"} as ${parsed.data.role === "admin" ? "an admin" : `an ${parsed.data.role}`}.`, "Open the link and sign in (or create an account) with this email address to accept. The link works once and expires in 7 days."],
    cta: { label: "Accept the invitation", url: link },
    footnote: "If you weren’t expecting this, you can ignore this email.",
  });
  const sent = await sendEmail({ to: parsed.data.email, subject: `Invitation to join ${startup?.name ?? "a startup"} on Buna`, html, text });
  if (sent.status === "sent") return { status: "success", message: `Invitation sent to ${parsed.data.email}.`, values: {} };
  return { status: "success", message: `Invitation created, but the email couldn’t be sent (${sent.status === "not_configured" ? "email isn’t configured" : "the provider rejected it"}). Share this one-time link with them yourself: ${link}`, values: {} };
}

export async function revokeInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireActiveProfile();
  const parsed = invitationRefSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_team_invitation", { p_id: parsed.data.invitationId });
  if (error) return { status: "error", message: teamError(error.message) };
  refresh(parsed.data.startupId);
  return { status: "success", message: "Invitation revoked." };
}

export async function changeMemberRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireActiveProfile();
  const parsed = memberRoleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Choose a role." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_role", { p_startup: parsed.data.startupId, p_user: parsed.data.userId, p_role: parsed.data.role });
  if (error) return { status: "error", message: teamError(error.message) };
  refresh(parsed.data.startupId);
  return { status: "success", message: "Role updated." };
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = memberRefSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_startup: parsed.data.startupId, p_user: parsed.data.userId });
  if (error) return { status: "error", message: teamError(error.message) };
  refresh(parsed.data.startupId);
  revalidatePath("/dashboard/startup");
  return { status: "success", message: parsed.data.userId === profile.id ? "You left the team." : "Removed from the team." };
}

export async function updateMyVisibilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData);
  const parsed = teamVisibilitySchema.safeParse({ ...raw, isPublic: formData.get("isPublic") === "on" });
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("startup_members").update({ is_public: parsed.data.isPublic, public_title: parsed.data.publicTitle }).eq("startup_id", parsed.data.startupId).eq("user_id", profile.id).select("user_id").maybeSingle();
  if (error || !data) return { status: "error", message: "We couldn’t save that." };
  refresh(parsed.data.startupId);
  return { status: "success", message: "Saved." };
}
