"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createLogger } from "@/lib/logger";
import { slugCandidate } from "@/lib/slug";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { opportunityIdSchema, opportunitySchema, opportunityStatusSchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("admin-opportunities");
const echo = (raw: Record<string, unknown>) => Object.fromEntries(["title", "organization", "description", "category", "eligibility", "deadline", "applicationUrl", "sourceUrl", "publishedDate", "status", "tags"].map((k) => [k, String(raw[k] ?? "")])) as Record<string, string | string[]>;
const touched = () => { revalidatePath("/opportunities", "layout"); revalidatePath("/admin/opportunities"); revalidatePath("/"); };

export async function saveOpportunityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const raw = formDataToObject(formData, ["countries"]);
  const input = { ...raw, markChecked: formData.get("markChecked") === "on" };
  const values = { ...echo(raw), countries: (raw.countries as string[]) ?? [] };
  const parsed = opportunitySchema.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values, message: "Fix the highlighted fields and save again." };
  const d = parsed.data;
  const supabase = await createClient();
  const row = {
    title: d.title, organization: d.organization, description: d.description, category: d.category, eligibility: d.eligibility, countries: d.countries,
    deadline: d.deadline, application_url: d.applicationUrl, source_url: d.sourceUrl, published_date: d.publishedDate, status: d.status, tags: d.tags,
    ...(d.markChecked ? { last_checked_at: new Date().toISOString() } : {}),
  };

  if (d.opportunityId) {
    const { data, error } = await supabase.from("opportunities").update(row).eq("id", d.opportunityId).select("id").maybeSingle();
    if (error || !data) { log.error("update failed", error); return { status: "error", message: "We couldn’t save the changes.", values }; }
    await writeAuditLog({ actorId: staff.id, action: "opportunity.update", entityType: "opportunity", entityId: d.opportunityId, metadata: { status: d.status } });
    touched();
    return { status: "success", message: "Saved." };
  }
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 8 && !createdId; attempt++) {
    const { data, error } = await supabase.from("opportunities").insert({ ...row, slug: slugCandidate(d.title, attempt, "opportunity"), created_by: staff.id, last_checked_at: new Date().toISOString() }).select("id").single();
    if (data) createdId = data.id as string;
    else if (error?.code !== "23505") { log.error("create failed", error); return { status: "error", message: "We couldn’t create the opportunity.", values }; }
  }
  if (!createdId) return { status: "error", fieldErrors: { title: ["Use a more distinctive title."] }, values };
  await writeAuditLog({ actorId: staff.id, action: "opportunity.create", entityType: "opportunity", entityId: createdId, metadata: { status: d.status } });
  touched();
  redirect(`/admin/opportunities/${createdId}`);
}

export async function setOpportunityStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = opportunityStatusSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunities").update({ status: parsed.data.status }).eq("id", parsed.data.opportunityId).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "We couldn’t change the status." };
  await writeAuditLog({ actorId: staff.id, action: `opportunity.${parsed.data.status}`, entityType: "opportunity", entityId: parsed.data.opportunityId });
  touched();
  return { status: "success", message: `Marked ${parsed.data.status}.` };
}

export async function markCheckedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = opportunityIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunities").update({ last_checked_at: new Date().toISOString() }).eq("id", parsed.data.opportunityId).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "We couldn’t record that." };
  await writeAuditLog({ actorId: staff.id, action: "opportunity.checked", entityType: "opportunity", entityId: parsed.data.opportunityId });
  touched();
  return { status: "success", message: "Marked as checked today." };
}
