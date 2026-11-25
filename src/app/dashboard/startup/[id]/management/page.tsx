import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Banknote, Building2, FileText, Settings2, ShieldCheck, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { canEditStartup, canManageTeam, canPublishStartup } from "@/lib/permissions";
import { getManagedStartup } from "@/lib/startups/queries";
import { getTeam } from "@/lib/team/queries";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATION_LABELS } from "@/lib/startups/constants";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Company management" };

export default async function CompanyManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/management`);
  const managed = await getManagedStartup(id, profile.id);
  if (!managed) notFound();
  const startup = managed.startup;
  const [team, verification] = await Promise.all([
    getTeam(id, canManageTeam(managed.role)),
    canPublishStartup(managed.role)
      ? (async () => {
          const db = await createClient();
          const result = await db.from("verification_requests").select("id,status,created_at,reviewed_at,decision_note").eq("startup_id",id).order("created_at",{ascending:false}).limit(8);
          if (result.error) throw result.error;
          return result.data ?? [];
        })()
      : Promise.resolve([]),
  ]);
  const canAdmin = canManageTeam(managed.role);
  const canPublish = canPublishStartup(managed.role);
  const status = startup.status;
  const verificationLabel = VERIFICATION_LABELS[startup.verification_status] ?? startup.verification_status;
  const currency = /^[A-Z]{3}$/.test(startup.funding_currency || "") ? startup.funding_currency : "USD";
  const fundingValue = startup.funding_target == null ? null : new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(startup.funding_target);
  const controls = [
    { title:"Team and permissions", description:"Invite teammates, change roles, manage public team visibility and transfer ownership.", href:`/dashboard/startup/${id}/team`, icon:Users },
    { title:"Company profile and fundraising", description:"Update company details, target market, business model and funding information.", href:`/dashboard/startup/${id}`, icon:Building2 },
    { title:"Fundraising and data room", description:"Manage private investor documents, access requests and investor updates.", href:`/dashboard/startup/${id}/fundraising`, icon:Banknote },
    { title:"Verification", description:"Submit evidence and follow the review history for your company.", href:`/dashboard/startup/${id}/verification`, icon:BadgeCheck },
    { title:"Publishing and public address", description:"Control whether your company is publicly listed and manage its Buna address.", href:`/dashboard/startup/${id}/settings`, icon:Settings2 },
    { title:"Company analytics", description:"Review audience, visits and engagement available for this company.", href:`/dashboard/startup/${id}/analytics`, icon:FileText },
  ];
  const visibleControls = controls.filter((item) => item.title !== "Fundraising and data room" || canEditStartup(managed.role));
  return <div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-deep">Company workspace</p><div className="mt-2 flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">Management overview</h2><Badge tone="neutral">{managed.role}</Badge><Badge tone={status==="published"?"success":"warning"}>{status.replace(/_/g," ")}</Badge></div><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Manage the people, public presence, verification and investor-facing information for {startup.name} from one place.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardBody className="p-5"><Users className="h-4 w-4 text-muted"/><p className="mt-3 text-2xl font-bold tabular-nums">{team.members.length}</p><p className="text-sm text-muted">Team members</p></CardBody></Card>
      <Card><CardBody className="p-5"><ShieldCheck className="h-4 w-4 text-muted"/><p className="mt-3 text-lg font-bold">{verificationLabel}</p><p className="text-sm text-muted">Verification status</p></CardBody></Card>
      <Card><CardBody className="p-5"><Banknote className="h-4 w-4 text-muted"/><p className="mt-3 text-lg font-bold">{fundingValue ?? "Not provided"}</p><p className="text-sm text-muted">Funding target</p></CardBody></Card>
      <Card><CardBody className="p-5"><FileText className="h-4 w-4 text-muted"/><p className="mt-3 text-lg font-bold">{startup.funding_round || "Not specified"}</p><p className="text-sm text-muted">Funding round</p></CardBody></Card>
    </section>
    <section className="space-y-3"><h3 className="font-semibold">Company controls</h3><div className="grid gap-3 md:grid-cols-2">{visibleControls.map(item=>{const Icon=item.icon;return <Card key={item.title}><CardBody className="flex items-start gap-3 p-5"><div className="rounded-lg bg-surface-secondary p-2"><Icon className="h-5 w-5 text-muted"/></div><div className="min-w-0 flex-1"><h4 className="font-semibold">{item.title}</h4><p className="mt-1 text-sm text-muted">{item.description}</p><Link href={item.href} className="mt-3 inline-flex items-center text-sm font-semibold text-primary-deep">Manage <ArrowRight className="ml-1 h-3.5 w-3.5"/></Link></div></CardBody></Card>})}</div></section>
    <section className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold">Team roster</h3><p className="mt-1 text-sm text-muted">Current access and membership dates</p></div><Link href={`/dashboard/startup/${id}/team`} className="text-sm font-semibold text-primary-deep">Manage team</Link></div></CardHeader><CardBody>{team.members.length?<ul className="divide-y divide-line">{team.members.map(m=><li key={m.user_id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{m.display_name||"Buna member"}{m.user_id===profile.id?" (you)":""}</p><p className="text-xs text-muted">Joined {formatDate(m.created_at)}</p></div><Badge tone={m.role==="owner"?"green":"neutral"}>{m.role}</Badge></li>)}</ul>:<p className="text-sm text-muted">No team members found.</p>}{canAdmin?<p className="mt-3 text-xs text-muted">{team.invitations.length} pending invitation(s)</p>:null}</CardBody></Card>
      <Card><CardHeader><h3 className="font-semibold">Verification history</h3><p className="mt-1 text-sm text-muted">Recent requests and review outcomes</p></CardHeader><CardBody>{!canPublish?<p className="text-sm text-muted">Only owners and admins can view verification requests.</p>:verification.length?<ul className="divide-y divide-line">{verification.map(v=><li key={v.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{formatDate(v.created_at)}</p><Badge tone={v.status==="approved"?"success":v.status==="pending"?"warning":"neutral"}>{v.status}</Badge></div>{v.reviewed_at?<p className="mt-1 text-xs text-muted">Reviewed {formatDate(v.reviewed_at)}</p>:null}{v.decision_note?<p className="mt-1 text-sm text-muted">{v.decision_note}</p>:null}</li>)}</ul>:<div className="space-y-2"><p className="text-sm text-muted">No verification requests have been submitted.</p><Link href={`/dashboard/startup/${id}/verification`} className="inline-flex items-center text-sm font-semibold text-primary-deep">Request verification <ArrowRight className="ml-1 h-3.5 w-3.5"/></Link></div>}</CardBody></Card>
    </section>
    <Card><CardBody className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="font-semibold">Need to change the public presence?</h3><p className="mt-1 text-sm text-muted">Publishing is controlled separately from editing. Your draft remains available if you unpublish.</p></div><Link href={`/dashboard/startup/${id}/settings`} className="inline-flex items-center text-sm font-semibold text-primary-deep">Open publishing settings <ArrowRight className="ml-1 h-4 w-4"/></Link></CardBody></Card>
  </div>;
}
