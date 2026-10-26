import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InquiryActions } from "@/components/team/inquiry-actions";
import { requireProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getInquiry } from "@/lib/inquiries/queries";
import { createClient } from "@/lib/supabase/server";
import { INQUIRY_CATEGORIES } from "@/lib/validation/network";
import { uuidField } from "@/lib/validation/startup";

export const metadata: Metadata = { title: "Inquiry", robots: { index: false } };
const EMAIL_NOTE: Record<string, { tone: "info" | "success" | "warning" | "error"; text: string }> = {
  sent: { tone: "success", text: "The notification email was sent to your team." },
  pending: { tone: "info", text: "The notification email is queued." },
  failed: { tone: "error", text: "The notification email couldn’t be sent. You can retry below — we also retry automatically." },
  not_configured: { tone: "warning", text: "No notification email was sent (email isn’t configured, or nobody on the team has inquiry emails turned on). The inquiry is safe here." },
};

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidField.safeParse(id).success) notFound();
  await requireProfile(`/dashboard/inquiries/${id}`);
  const i = await getInquiry(id);
  if (!i) notFound();
  if (!i.read_at) {
    // opening an inquiry marks it read
    const supabase = await createClient();
    await supabase.from("inquiries").update({ read_at: new Date().toISOString(), status: i.status === "new" ? "read" : i.status }).eq("id", id);
    i.read_at = new Date().toISOString();
    if (i.status === "new") i.status = "read";
  }
  const note = EMAIL_NOTE[i.email_status] ?? EMAIL_NOTE.pending!;
  const topic = INQUIRY_CATEGORIES.find((c) => c.value === i.category)?.label ?? i.category;
  return (
    <div className="space-y-6">
      <p className="text-sm"><Link href="/dashboard/inquiries" className="font-medium">All inquiries</Link></p>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{i.subject}</h1><Badge tone={i.status === "spam" ? "danger" : "neutral"}>{i.status}</Badge></div>
      <Card>
        <CardHeader><dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">From</dt><dd className="font-medium">{i.sender_name}</dd></div>
          <div><dt className="text-muted">Email</dt><dd className="break-all font-medium">{i.sender_email}</dd></div>
          <div><dt className="text-muted">For</dt><dd className="font-medium">{i.startup ? <Link href={`/startups/${i.startup.slug}`}>{i.startup.name}</Link> : "—"}</dd></div>
          <div><dt className="text-muted">Topic · received</dt><dd className="font-medium">{topic} · <time dateTime={i.created_at}>{formatDateTime(i.created_at)}</time></dd></div>
        </dl></CardHeader>
        <CardBody className="space-y-4">
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{i.message}</p>
          <a href={`mailto:${i.sender_email}?subject=${encodeURIComponent(`Re: ${i.subject}`)}`} className={buttonStyles("primary", "md")}><Mail className="h-4 w-4" aria-hidden="true" />Reply by email</a>
          <p className="text-xs text-muted">Replies go straight to the sender from your own email — Buna doesn’t see them. Be wary of unexpected links and attachments.</p>
        </CardBody>
      </Card>
      <Alert tone={note.tone}>{note.text}</Alert>
      <InquiryActions inquiryId={i.id} status={i.status} canRetry={i.email_status !== "sent"} />
    </div>
  );
}
