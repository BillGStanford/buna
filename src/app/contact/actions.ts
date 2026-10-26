"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/session";
import { isEmailConfigured, isServiceRoleConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail } from "@/lib/email/templates";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { contactSchema } from "@/lib/validation/network";
import type { ActionState } from "@/lib/types";

const log = createLogger("contact");

export async function sendContactMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = { name: String(raw.name ?? ""), email: String(raw.email ?? ""), topic: String(raw.topic ?? ""), message: String(raw.message ?? "") };
  if (String(raw.website ?? "").trim() !== "") return { status: "success", message: "Thanks — we’ve received your message." };
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!isServiceRoleConfigured()) return { status: "error", message: "The contact form isn’t available right now.", values };
  const ip = await clientIp();
  if (!(await rateLimit(`contact:ip:${ip}`, 5, 3600)) || !(await rateLimit(`contact:email:${parsed.data.email}`, 3, 86400))) return { status: "error", message: "You’ve sent several messages recently. Please try again later.", values };

  const user = await getUser();
  const admin = createAdminClient();
  const { error } = await admin.rpc("create_platform_message", { p_sender: user?.id ?? null, p_name: parsed.data.name, p_email: parsed.data.email, p_topic: parsed.data.topic, p_message: parsed.data.message });
  if (error) { log.error("create_platform_message failed", error); return { status: "error", message: "We couldn’t send your message. Please try again.", values }; }

  const support = process.env.SUPPORT_EMAIL?.trim();
  if (support && isEmailConfigured()) {
    const { html, text } = renderEmail({ heading: "New message from the Buna contact form", paragraphs: [`From: ${parsed.data.name} <${parsed.data.email}>`, `Topic: ${parsed.data.topic}`, parsed.data.message] });
    after(() => sendEmail({ to: support, subject: `Buna contact: ${parsed.data.topic}`, html, text, replyTo: parsed.data.email }).then((r) => { if (r.status === "failed") log.error("support email failed", r.error); }));
  }
  return { status: "success", message: "Thanks — we’ve received your message and will reply to your email address.", values: {} };
}
