import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Plus, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/illustrations";
import { StartupLogo } from "@/components/startups/startup-logo";
import { requireProfile } from "@/lib/auth/session";
import { STATUS_LABELS } from "@/lib/startups/constants";
import { listMyStartups } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Your companies" };

export default async function MyStartupsPage() {
  const profile = await requireProfile("/dashboard/startup");
  const startups = await listMyStartups(profile.id);
  const published = startups.filter((s) => s.status === "published").length;
  const drafts = startups.filter((s) => s.status === "draft").length;
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-primary-deep">Business workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Your companies</h1><p className="mt-2 text-sm text-muted">Create, build, and manage the companies you represent on Buna.</p></div>
        {!profile.is_suspended ? <Link href="/dashboard/startup/new" className={buttonStyles("primary","md")}><Plus className="h-4 w-4"/> Add a company</Link> : null}
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["All companies",startups.length],["Published",published],["Drafts",drafts]].map(([label,value])=><Card key={label}><CardBody className="p-4"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></CardBody></Card>)}
      </div>
      {startups.length === 0 ? <Card><CardBody className="p-7"><EmptyState illustration="startups" title="Your first company starts here" action={!profile.is_suspended ? <Link href="/dashboard/startup/new" className={buttonStyles("primary","md")}>Create your company</Link> : undefined}>Start with your website or enter the basics yourself. Your profile stays private until you choose to publish.</EmptyState></CardBody></Card> : (
        <div className="space-y-3">{startups.map((s)=>{const st=STATUS_LABELS[s.status]??{label:s.status,tone:"neutral" as const};return <Card key={s.id}><CardBody className="flex flex-wrap items-center gap-4 p-4 sm:p-5"><StartupLogo name={s.name} src={s.logo_url} size={52}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{s.name}</h2><Badge tone={st.tone}>{st.label}</Badge>{s.is_demo?<Badge tone="warning">Demo</Badge>:null}</div><p className="mt-1 truncate text-sm text-muted">{s.tagline||"Add a short description to introduce your company."}</p></div><div className="flex w-full gap-2 sm:w-auto"><Link href={`/startups/${s.slug}`} className={buttonStyles("secondary","sm")}>{s.status==="published"?"View page":"Preview"}</Link><Link href={`/dashboard/startup/${s.id}`} className={buttonStyles("primary","sm")}>Manage <ArrowRight className="h-3.5 w-3.5"/></Link></div></CardBody></Card>})}</div>
      )}
      <div className="rounded-xl border border-line bg-primary-pale/30 p-5"><div className="flex items-start gap-3"><Rocket className="mt-0.5 h-5 w-5 text-primary-deep"/><div><h2 className="font-semibold">A company page is your foundation</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted">After creating your company, add products, introduce your team, share milestones, and publish updates. Launch a specific product separately when you&apos;re ready.</p></div></div></div>
    </div>
  );
}
