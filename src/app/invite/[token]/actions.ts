"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { sha256Hex } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { inviteTokenSchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("invite");

function acceptError(message: string): string {
  if (message.includes("email_mismatch")) return "This invitation was sent to a different email address. Sign in with the invited address to accept it.";
  if (message.includes("email_not_verified")) return "Confirm your email address first, then open the invitation again.";
  if (message.includes("invitation_used")) return "This invitation has already been used or was withdrawn.";
  if (message.includes("invitation_expired")) return "This invitation has expired. Ask the team to send a new one.";
  if (message.includes("not_found")) return "This invitation link isn’t valid.";
  if (message.includes("account_suspended")) return "Your account is suspended.";
  return "We couldn’t accept the invitation. Please try again.";
}

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const parsedToken = inviteTokenSchema.safeParse(token);
  if (!parsedToken.success) return { status: "error", message: "This invitation link isn’t valid." };
  const profile = await requireProfile(`/invite/${token}`);
  if (!(await rateLimit(`accept-invite:${profile.id}`, 10, 3600))) return { status: "error", message: "Too many attempts. Please wait a few minutes." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_team_invitation", { p_token_hash: sha256Hex(token) });
  if (error) {
    if (!/email_mismatch|email_not_verified|invitation_used|invitation_expired|not_found|account_suspended/.test(error.message)) log.error("accept failed", error, { code: error.code });
    return { status: "error", message: acceptError(error.message) };
  }
  redirect(`/dashboard/startup/${String(data)}`);
}
