import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { listFounderSubmissions } from "@/lib/investors/queries";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/illustrations";

export const metadata: Metadata = { title: "My investor connections", robots: { index: false } };

export default async function FounderInvestorSubmissionsPage() {
  const profile = await requireProfile("/dashboard/investor/submissions");
  const submissions = await listFounderSubmissions(profile.id);
  return <div className="space-y-5">
    <div><p className="text-sm text-muted"><Link href="/dashboard/investor">Capital connections</Link></p><h1 className="text-2xl font-bold">My investor connections</h1><p className="mt-1 text-sm text-muted">Track the introductions and pitches you have sent.</p></div>
    {submissions.length ? <ul className="divide-y divide-line rounded-lg border border-line">{submissions.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{s.startup_name}</p><p className="text-sm text-muted">To {s.investor?.name ?? "Investor"} · {new Date(s.created_at).toLocaleDateString()}</p></div><Badge>{s.status.replace(/_/g," ")}</Badge><Link href={"/dashboard/investor/conversations/" + s.id} className="text-sm font-medium underline">Open conversation</Link></li>)}</ul> : <EmptyState illustration="inbox" title="No investor requests sent yet">Browse the <Link href="/investors" className="font-medium underline">investor directory</Link> and request an introduction from a participating investor.</EmptyState>}
  </div>;
}
