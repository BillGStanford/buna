"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createLogger } from "@/lib/logger";
import { isAdmin } from "@/lib/permissions";
import { slugCandidate } from "@/lib/slug";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { investorSchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("admin-investors");

export async function saveInvestorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const raw = formDataToObject(formData, ["stages", "sectors"]);
  const input = { ...raw, isPublished: formData.get("isPublished") === "on" };
  const parsed = investorSchema.safeParse(input);
  const values = { name: String(raw.name ?? ""), description: String(raw.description ?? ""), websiteUrl: String(raw.websiteUrl ?? ""), country: String(raw.country ?? ""), regions: String(raw.regions ?? ""), thesis: String(raw.thesis ?? ""), contactUrl: String(raw.contactUrl ?? ""), stages: (raw.stages as string[]) ?? [], sectors: (raw.sectors as string[]) ?? [] };
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values, message: "Fix the highlighted fields and save again." };
  const d = parsed.data;
  const supabase = await createClient();

  let verification = d.verificationStatus;
  if (d.investorId) {
    const { data: current } = await supabase.from("investors").select("verification_status").eq("id", d.investorId).maybeSingle();
    if (current && current.verification_status !== verification && !isAdmin(staff.role)) return { status: "error", message: "Only admins can change verification status.", values };
  } else if (!isAdmin(staff.role)) verification = "unverified";

  const row = { name: d.name, description: d.description, website_url: d.websiteUrl, country: d.country, regions: d.regions, stages: d.stages, sectors: d.sectors, thesis: d.thesis, contact_url: d.contactUrl, verification_status: verification, is_published: d.isPublished };
  if (d.investorId) {
    const { data, error } = await supabase.from("investors").update(row).eq("id", d.investorId).select("id").maybeSingle();
    if (error || !data) { log.error("investor update failed", error); return { status: "error", message: "We couldn’t save the changes.", values }; }
    await writeAuditLog({ actorId: staff.id, action: "investor.update", entityType: "investor", entityId: d.investorId, metadata: { verification, published: d.isPublished } });
    revalidatePath("/investors", "layout");
    return { status: "success", message: "Saved." };
  }
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 8 && !createdId; attempt++) {
    const { data, error } = await supabase.from("investors").insert({ ...row, slug: slugCandidate(d.name, attempt, "investor"), created_by: staff.id }).select("id").single();
    if (data) createdId = data.id as string;
    else if (error?.code !== "23505") { log.error("investor create failed", error); return { status: "error", message: "We couldn’t create the listing.", values }; }
  }
  if (!createdId) return { status: "error", fieldErrors: { name: ["Use a more distinctive name."] }, values };
  await writeAuditLog({ actorId: staff.id, action: "investor.create", entityType: "investor", entityId: createdId });
  revalidatePath("/investors", "layout");
  redirect(`/admin/investors/${createdId}`);
}
