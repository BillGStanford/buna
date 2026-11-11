"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/types";

const roles = ["partner","investment_manager","analyst","associate","member","observer"] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function manageInvestorTeamAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  if (!(await rateLimit("investor-team:" + profile.id, 30, 3600))) return { status: "error", message: "Please wait before making more team changes." };
  const action = String(fd.get("action") ?? "");
  const roles = fd.getAll("roles").map((value) => String(value));\n  const selectedRoles = roles.length ? [...new Set(roles)] : [String(fd.get("role") ?? "member")];
  const supabase = await createClient();
  const { data: investorId } = await supabase.rpc("current_investor_id");
  if (!investorId) return { status: "error", message: "No active investor workspace was found." };
  if (action === "add") {
    const username = String(fd.get("username") ?? "").trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username) || !selectedRoles.every((role) => roles.includes(role as typeof roles[number]))) {
      return { status: "error", message: "Enter a valid Buna username and team role." };
    }
    const admin = createAdminClient();
    const { data: member } = await admin.from("profiles").select("id,username,is_suspended").ilike("username", username).maybeSingle();
    if (!member || member.is_suspended) return { status: "error", message: "No active Buna account was found for that username." };
    if (member.id === profile.id) return { status: "error", message: "You are already part of this investor team." };
    const { error } = await supabase.rpc("manage_investor_membership", {
      p_investor: investorId, p_target_user: member.id, p_roles: selectedRoles, p_action: "add",
    });
    if (error) return { status: "error", message: error.code === "42501" ? "Only an owner or partner can manage this team." : "The team member could not be added." };
  } else {
    const userId = String(fd.get("userId") ?? "");
    if (!uuid.test(userId)) return { status: "error", message: "Select a valid team member." };
    if (action === "set_roles" && (!selectedRoles.length || !selectedRoles.every((role) => roles.includes(role as typeof roles[number])))) return { status: "error", message: "Choose one or more valid team roles." };
    if (action !== "set_roles" && action !== "remove") return { status: "error", message: "Unsupported team action." };
    const { error } = await supabase.rpc("manage_investor_membership", {
      p_investor: investorId, p_target_user: userId, p_roles: selectedRoles, p_action: action,
    });
    if (error) return { status: "error", message: error.code === "42501" ? "Only an owner or partner can manage this team." : "The team change could not be saved." };
  }
  revalidatePath("/dashboard/investor/team");
  revalidatePath("/investors");
  return { status: "success", message: "Investor team updated." };
}
