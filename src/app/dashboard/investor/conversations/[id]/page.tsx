import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorSubmission, listInvestorMessages } from "@/lib/investors/queries";
import { InvestorMessageForm } from "@/components/investors/investor-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Investor conversation", robots: { index: false } };

export default async function FounderInvestorConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile("/dashboard/investor/submissions");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const submission = await getInvestorSubmission(id);
  if (!submission || submission.founder_id !== profile.id) notFound();
  const messages = await listInvestorMessages(id);
  return <div className="max-w-3xl space-y-5">
    <p className="text-sm"><Link href="/dashboard/investor/submissions">← My investor connections</Link></p>
    <header><h1 className="text-2xl font-bold">{submission.startup_name}</h1><p className="mt-1 text-sm text-muted">To {submission.investor?.name ?? "Investor"} · <Badge>{submission.status.replace(/_/g," ")}</Badge></p></header>
    <Card><CardHeader><h2 className="font-semibold">Your pitch</h2></CardHeader><CardBody><p className="whitespace-pre-wrap text-sm">{submission.summary}</p>{submission.investor_response ? <div className="mt-4 rounded-lg bg-primary-pale p-3"><p className="text-xs font-semibold">Investor response</p><p className="mt-1 whitespace-pre-wrap text-sm">{submission.investor_response}</p></div> : null}</CardBody></Card>
    <Card><CardHeader><h2 className="font-semibold">Conversation</h2></CardHeader><CardBody className="space-y-4">
      {messages.length ? <ul className="space-y-3">{messages.map((m) => <li key={m.id} className="rounded-lg bg-primary-pale p-3"><p className="text-xs font-semibold">{m.sender?.display_name || m.sender?.username || "Buna member"} · {new Date(m.created_at).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p></li>)}</ul> : <p className="text-sm text-muted">No messages yet. You can send a follow-up to the investor here.</p>}
      <InvestorMessageForm submissionId={id} />
    </CardBody></Card>
  </div>;
}
