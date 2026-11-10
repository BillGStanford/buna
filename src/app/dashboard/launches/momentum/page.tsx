import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { listMyLaunches } from "@/lib/launches/queries";
import { getSiteUrl } from "@/lib/env";
import { ShareButton } from "@/components/startups/share-button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LAUNCH_STATUS_LABELS } from "@/lib/launches/constants";

export const metadata: Metadata = { title: "Launch Momentum" };

export default async function LaunchMomentumPage() {
  const profile = await requireProfile("/dashboard/launches/momentum");
  const launches = await listMyLaunches(profile.id);
  const live = launches.filter((launch) => launch.status === "published");
  return (
    <div className="space-y-6">
      <div><p className="text-sm"><Link href="/dashboard/launches" className="font-medium">My launches</Link></p><h1 className="text-2xl font-bold">Launch Momentum</h1><p className="mt-1 max-w-2xl text-sm text-muted">A practical workspace for preparing, distributing and learning from each Buna launch.</p></div>
      <Card><CardBody className="space-y-3"><h2 className="font-semibold">Your launch playbook</h2><ol className="list-decimal space-y-2 pl-5 text-sm text-muted"><li>Prepare a clear one-sentence explanation of the problem and who your product helps.</li><li>Add strong screenshots and confirm the product link works on mobile.</li><li>Tell existing customers, collaborators and relevant communities when your launch is live. Follow each community’s self-promotion rules.</li><li>Answer questions on your product page; useful discussion builds trust.</li><li>Review your Audience Intelligence and product analytics after launch to learn which audiences and channels respond.</li></ol></CardBody></Card>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Share your live products</h2>{live.length === 0 ? <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">Your published launches will appear here with a direct sharing link.</p> : <ul className="space-y-3">{live.map((launch) => { const status = LAUNCH_STATUS_LABELS[launch.status]; const url = `${getSiteUrl()}/launches/${launch.slug}`; return <li key={launch.id}><Card><CardBody className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><h3 className="font-semibold">{launch.name}</h3><p className="truncate text-sm text-muted">{launch.tagline}</p><Badge tone={status?.tone ?? "neutral"}>{status?.label ?? launch.status}</Badge><p className="mt-1 text-xs text-muted">{launch.vote_count} votes · {launch.comment_count} comments</p></div><ShareButton url={url} title={launch.name}/><Link href={`/launches/${launch.slug}`} className="text-sm font-medium">View launch</Link></CardBody></Card></li>; })}</ul>}</section>
      <p className="text-xs text-muted">This workspace provides practical launch guidance and sharing tools. Existing Buna analytics remain the source for measured audience and conversion data; no ranking or virality outcome is guaranteed.</p>
    </div>
  );
}
