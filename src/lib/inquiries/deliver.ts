import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, isServiceRoleConfigured, getSiteUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail } from "@/lib/email/templates";
import { createLogger } from "@/lib/logger";

const log = createLogger("inquiry-email");

/**
 * Emails an inquiry to the startup's team (owners, admins and editors who have inquiry emails on) with the
 * sender as reply-to. Recipient-level delivery records make retries skip anyone who already received it.
 */
export async function deliverInquiryEmails(inquiryId: string): Promise<"sent" | "failed" | "not_configured"> {
  if (!isServiceRoleConfigured()) return "not_configured";
  const admin = createAdminClient();
  const finish = async (status: "sent" | "failed" | "not_configured", error?: string) => {
    await admin.rpc("mark_inquiry_email", { p_id: inquiryId, p_status: status, p_error: error ?? null });
    return status;
  };
  try {
    const { data: inquiry, error: inquiryError } = await admin.from("inquiries")
      .select("id, subject, message, sender_name, sender_email, category, startup:startups(name, slug)")
      .eq("id", inquiryId).maybeSingle();
    if (inquiryError || !inquiry) return "failed";
    if (!isEmailConfigured()) return await finish("not_configured");
    const { data: recipients, error: recipientsError } = await admin.rpc("inquiry_recipients", { p_inquiry: inquiryId });
    if (recipientsError) throw recipientsError;
    const list = (recipients ?? []) as { user_id: string; email: string }[];
    if (list.length === 0) return await finish("not_configured", "no recipient has inquiry emails turned on");

    const startup = (Array.isArray(inquiry.startup) ? inquiry.startup[0] : inquiry.startup) as { name: string; slug: string } | null;
    const { html, text } = renderEmail({
      heading: `New inquiry for ${startup?.name ?? "your startup"}`,
      paragraphs: [`From: ${inquiry.sender_name} <${inquiry.sender_email}>`, `Subject: ${inquiry.subject}`, inquiry.message, "Reply to this email to answer them directly."],
      cta: { label: "Open in your dashboard", url: `${getSiteUrl()}/dashboard/inquiries/${inquiry.id}` },
      footnote: "You’re receiving this because you’re on this startup’s team on Buna. Replies go to the sender, not to Buna.",
    });
    let failure: string | null = null;
    for (const recipient of list) {
      const { data: claimed, error: claimError } = await admin.rpc("claim_inquiry_email_recipient", {
        p_inquiry: inquiryId, p_recipient: recipient.user_id, p_email: recipient.email,
      });
      if (claimError) throw claimError;
      if (!claimed) continue; // already sent or another worker currently owns this delivery

      const result = await sendEmail({
        to: recipient.email,
        subject: `New inquiry: ${inquiry.subject}`.slice(0, 120),
        html,
        text,
        replyTo: inquiry.sender_email,
      });
      const sent = result.status === "sent";
      const deliveryError = result.status === "failed" ? result.error : result.status === "not_configured" ? "not configured" : null;
      const { error: finishRecipientError } = await admin.rpc("finish_inquiry_email_recipient", {
        p_inquiry: inquiryId, p_recipient: recipient.user_id, p_status: sent ? "sent" : "failed", p_error: deliveryError,
      });
      if (finishRecipientError) throw finishRecipientError;
      if (!sent) failure = deliveryError ?? "email delivery failed";
    }
    return failure ? await finish("failed", failure) : await finish("sent");
  } catch (err) {
    log.error("inquiry delivery threw", err);
    return await finish("failed", "unexpected error");
  }
}

/** Retries recent inquiries whose email didn't go out (called by the daily job). */
export async function retryPendingInquiryEmails(limit = 25): Promise<number> {
  if (!isServiceRoleConfigured()) return 0;
  const admin = createAdminClient();
  const { data } = await admin.rpc("pending_inquiry_emails", { p_limit: limit });
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  for (const id of ids) await deliverInquiryEmails(id);
  return ids.length;
}
