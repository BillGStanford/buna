import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal, listInvestorSubmissions } from "@/lib/investors/queries";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/illustrations";

export const metadata: Metadata = { title: "Investor inbox", robots: { index: false } };

export default async function InvestorInboxPage() {
  const profile = await requireProfile("/dashboard/investor/inbox");
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor");
  const submissions = await listInvestorSubmissions(investor.id);
  return <div className="space-y-5">
    <div><p className="text-sm text-muted"><Link href="/dashboard/investor">Investor workspace</Link></p><h1 className="text-2xl font-bold">Founder inbox</h1><p className="mt-1 text-sm text-muted">Review pitches, respond to founders, and move opportunities through your pipeline.</p></div>
    {submissions.length ? <ul className="divide-y divide-line rounded-lg border border-line">{submissions.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1"><Link href={"/dashboard/investor/inbox/" + s.id} className="font-semibold">{s.startup_name}</Link><p className="mt-1 line-clamp-2 text-sm text-muted">{s.summary}</p><p className="mt-1 text-xs text-muted">{s.submission_type === "pitch" ? "Pitch submission" : "Introduction request"} · {new Date(s.created_at).toLocaleDateString()}</p></div><Badge tone={s.status === "new" ? "green" : "neutral"}>{s.status.replace(/_/g," ")}</Badge>
    </li>)}</ul> : <EmptyState illustration="inbox" title="No founder requests yet">Your inbox is active. When a founder requests an introduction or submits a pitch, it will appear here.</EmptyState>}
  </div>;
}
