"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/session";
import { isServiceRoleConfigured } from "@/lib/env";
import { deliverInquiryEmails } from "@/lib/inquiries/deliver";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { inquirySchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("inquiry");
const TOO_MANY: ActionState = { status: "error", message: "You’ve sent several messages recently. Please try again later." };

/**
 * Public contact form for a startup. Stored through a service-role function (visitors have no write access to
 * the table), protected by a honeypot, rate limits and a link-count check, and de-duplicated in the database.
 */
export async function sendInquiryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = { name: String(raw.name ?? ""), email: String(raw.email ?? ""), category: String(raw.category ?? ""), subject: String(raw.subject ?? ""), message: String(raw.message ?? "") };
  // honeypot: real people never see or fill this field; bots do. Pretend success so they learn nothing.
  if (String(raw.website ?? "").trim() !== "") return { status: "success", message: "Thanks — your message was sent." };
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!isServiceRoleConfigured()) return { status: "error", message: "Messaging isn’t available right now. Please try again later.", values };

  const user = await getUser();
  const ip = await clientIp();
  const d = parsed.data;
  if (!(await rateLimit(`inquiry:ip:${ip}`, 5, 3600)) || !(await rateLimit(`inquiry:email:${d.email}`, 3, 86400)) || !(await rateLimit(`inquiry:startup:${d.startupId}:${ip}`, 3, 86400))) return { ...TOO_MANY, values };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_inquiry", { p_startup: d.startupId, p_sender: user?.id ?? null, p_name: d.name, p_email: d.email, p_category: d.category, p_subject: d.subject, p_message: d.message });
  if (error) {
    if (error.message.includes("startup_unavailable")) return { status: "error", message: "That startup isn’t accepting messages.", values };
    log.error("create_inquiry failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t send your message. Please try again.", values };
  }
  const id = String(data);
  after(() => deliverInquiryEmails(id).catch((e) => log.error("delivery failed", e)));
  return { status: "success", message: "Thanks — your message was sent to the team. They’ll reply to your email address.", values: {} };
}
