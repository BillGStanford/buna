import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal, getInvestorSubmission, listInvestorMessages } from "@/lib/investors/queries";
import { InvestorMessageForm, InvestorPipelineForm } from "@/components/investors/investor-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Founder submission", robots: { index: false } };

export default async function InvestorInboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile("/dashboard/investor/inbox");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor");
  const submission = await getInvestorSubmission(id);
  if (!submission || submission.investor_id !== investor.id) notFound();
  const messages = await listInvestorMessages(id);
  return <div className="max-w-3xl space-y-5">
    <p className="text-sm"><Link href="/dashboard/investor/inbox">← Back to inbox</Link></p>
    <header><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{submission.startup_name}</h1><Badge>{submission.status.replace(/_/g," ")}</Badge></div><p className="mt-1 text-sm text-muted">{submission.submission_type === "pitch" ? "Pitch submission" : "Introduction request"} · {new Date(submission.created_at).toLocaleString()}</p></header>
    <Card><CardHeader><h2 className="font-semibold">Founder pitch</h2></CardHeader><CardBody className="space-y-4">
      <div><p className="text-xs font-semibold uppercase text-muted">What they are building</p><p className="mt-1 whitespace-pre-wrap text-sm">{submission.summary}</p></div>
      <div><p className="text-xs font-semibold uppercase text-muted">Why you are a fit</p><p className="mt-1 whitespace-pre-wrap text-sm">{submission.fit_reason}</p></div>
      <div className="grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-muted">Stage:</span> {submission.stage || "Not specified"}</p><p><span className="text-muted">Funding sought:</span> {submission.funding_amount ? submission.funding_currency + " " + Number(submission.funding_amount).toLocaleString() : "Not specified"}</p></div>
      {submission.pitch_deck_url ? <a href={submission.pitch_deck_url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium underline">Open pitch deck / supporting document</a> : null}
    </CardBody></Card>
    <InvestorPipelineForm submissionId={id} status={submission.status} response={submission.investor_response} />
    <Card><CardHeader><h2 className="font-semibold">Conversation with founder</h2></CardHeader><CardBody className="space-y-4">
      {messages.length ? <ul className="space-y-3">{messages.map((m) => <li key={m.id} className="rounded-lg bg-primary-pale p-3"><p className="text-xs font-semibold">{m.sender?.display_name || m.sender?.username || "Buna member"} · {new Date(m.created_at).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p></li>)}</ul> : <p className="text-sm text-muted">No messages yet. Send a note to begin the conversation.</p>}
      <InvestorMessageForm submissionId={id} />
    </CardBody></Card>
  </div>;
}
