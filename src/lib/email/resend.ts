import "server-only";
import { Resend } from "resend";
import { createLogger } from "@/lib/logger";
import { isEmailConfigured } from "@/lib/env";

const log = createLogger("email");

export type SendResult =
  | { status: "sent"; id: string | null }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

/**
 * Transactional email through Resend. Never throws: callers persist their own record first
 * (e.g. an inquiry) and store the returned status so failures are visible and retryable.
 * Supabase Auth emails (verification, reset) go through Supabase SMTP — see README.
 */
export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) return { status: "not_configured" };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM as string,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    if (error) {
      log.error("resend rejected message", error);
      return { status: "failed", error: error.message };
    }
    return { status: "sent", id: data?.id ?? null };
  } catch (err) {
    log.error("resend call threw", err);
    return { status: "failed", error: err instanceof Error ? err.message : "Unknown email error" };
  }
}
