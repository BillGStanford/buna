"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { deliverInquiryEmails } from "@/lib/inquiries/deliver";
import { rateLimit } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation/common";
import { inquiryStatusSchema } from "@/lib/validation/network";
import { uuidField } from "@/lib/validation/startup";
import type { ActionState } from "@/lib/types";

export async function setInquiryStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireActiveProfile();
  const parsed = inquiryStatusSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("inquiries").update({ status: parsed.data.status, ...(parsed.data.status === "new" ? { read_at: null } : { read_at: new Date().toISOString() }) }).eq("id", parsed.data.inquiryId).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "You can’t change that inquiry." };
  revalidatePath("/dashboard/inquiries", "layout");
  return { status: "success", message: "Updated." };
}

/** Re-sends the notification email for an inquiry (owners/admins/editors only — the select below proves access). */
export async function retryInquiryEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const id = uuidField.safeParse(formData.get("inquiryId"));
  if (!id.success) return { status: "error", message: "Something went wrong." };
  if (!(await rateLimit(`inquiry-retry:${profile.id}`, 10, 3600))) return { status: "error", message: "Please wait a few minutes before retrying again." };
  const supabase = await createClient();
  const { data } = await supabase.from("inquiries").select("id").eq("id", id.data).maybeSingle();
  if (!data) return { status: "error", message: "You can’t access that inquiry." };
  const result = await deliverInquiryEmails(id.data);
  revalidatePath(`/dashboard/inquiries/${id.data}`);
  return result === "sent" ? { status: "success", message: "Email sent." } : { status: "error", message: result === "not_configured" ? "Email isn’t configured on this site (or nobody has inquiry emails turned on)." : "The email provider rejected it. We’ll keep retrying." };
}
