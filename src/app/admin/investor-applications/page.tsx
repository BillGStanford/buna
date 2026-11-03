import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { listPendingInvestorApplications } from "@/lib/investors/queries";
import { reviewInvestorApplicationAction } from "@/app/dashboard/investor/actions";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TextField } from "@/components/ui/fields";

export const metadata: Metadata = { title: "Investor applications", robots: { index: false } };

export default async function AdminInvestorApplicationsPage() {
  await requireStaff();
  const applications = await listPendingInvestorApplications();
  return <div className="space-y-5">
    <div><p className="text-sm"><Link href="/admin">Admin</Link></p><h1 className="text-2xl font-bold">Investor applications</h1><p className="mt-1 text-sm text-muted">Review ownership, professional background, track record, and the evidence supplied before approving access.</p></div>
    {applications.length ? <ul className="space-y-4">{applications.map((a) => <li key={a.id}><Card><CardBody className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">{a.organization_name}</h2><p className="text-sm text-muted">Applicant: {a.applicant?.display_name || a.applicant?.username || a.user_id} · {new Date(a.created_at).toLocaleString()}</p></div><Badge tone="warning">{a.investor_type.replace(/_/g," ")}</Badge></div>
      <p className="whitespace-pre-wrap text-sm">{a.background}</p>
      <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Markets:</strong> {a.markets.join(", ") || "Not specified"}</p><p><strong>Stages:</strong> {a.stages.join(", ") || "Not specified"}</p><p><strong>Sectors:</strong> {a.sectors.join(", ") || "Not specified"}</p><p><strong>Range:</strong> {a.investment_min ?? "—"} to {a.investment_max ?? "—"} {a.investment_currency}</p><p><strong>Portfolio:</strong> {a.portfolio || "Not supplied"}</p><p><strong>Email:</strong> {a.contact_email || "—"}</p><p><strong>Phone:</strong> {a.contact_phone || "—"}</p><p><strong>WhatsApp:</strong> {a.whatsapp || "—"}</p><p><strong>Facebook:</strong> {a.facebook || "—"}</p><p><strong>Telegram:</strong> {a.telegram || "—"}</p></div>
      <div className="flex flex-wrap gap-3 text-sm">{a.website_url ? <a href={a.website_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">Website</a> : null}{a.proof_url ? <a href={a.proof_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">Verification evidence</a> : null}{a.existing_investor_id ? <Link href={"/admin/investors/" + a.existing_investor_id} className="underline">Claim existing listing</Link> : null}</div>
      <form action={reviewInvestorApplicationAction} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><input type="hidden" name="applicationId" value={a.id} /><TextField label="Review note (optional)" name="note" maxLength={500} /><button name="decision" value="approve" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Approve</button><button name="decision" value="reject" className="rounded-md border border-line px-4 py-2 text-sm font-semibold">Reject</button></form>
    </CardBody></Card></li>)}</ul> : <Card><CardBody><p className="text-sm text-muted">No investor applications are waiting for review.</p></CardBody></Card>}
  </div>;
}
