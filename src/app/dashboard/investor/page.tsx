import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal, listInvestorSubmissions } from "@/lib/investors/queries";
import { InvestorApplicationForm } from "@/components/investors/investor-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Investor Mode", robots: { index: false } };

export default async function InvestorPortalPage({ searchParams }: { searchParams: Promise<{ investorId?: string }> }) {
  const profile = await requireProfile("/dashboard/investor");
  const { investorId = "" } = await searchParams;
  const { application, investor } = await getInvestorPortal(profile.id);

  if (investor) {
    const submissions = await listInvestorSubmissions(investor.id);
    const active = submissions.filter((s) => !["declined", "closed"].includes(s.status)).length;
    return <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-muted">Investor workspace</p><h1 className="text-2xl font-bold">{investor.name}</h1><p className="mt-1 text-sm text-muted">Manage your capital connections on Buna.</p></div>
        <Badge tone={investor.verification_status === "verified" ? "green" : "warning"}>{investor.verification_status === "verified" ? "Verified" : "Approval active · verification pending"}</Badge>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardBody><p className="text-sm text-muted">All submissions</p><p className="mt-1 text-3xl font-bold">{submissions.length}</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-muted">Active pipeline</p><p className="mt-1 text-3xl font-bold">{active}</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-muted">New requests</p><p className="mt-1 text-3xl font-bold">{submissions.filter((s) => s.status === "new").length}</p></CardBody></Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/investor/inbox" className={buttonStyles("primary","md")}>Open investor inbox</Link>
        <Link href={"/investors/" + investor.slug} className={buttonStyles("secondary","md")}>View public profile</Link>
        <Link href="/dashboard/investor/profile" className={buttonStyles("secondary","md")}>Manage profile</Link>
        <Link href="/dashboard/investor/startups" className={buttonStyles("secondary","md")}>Saved startups</Link>
        <Link href="/startups" className={buttonStyles("secondary","md")}>Discover startups</Link>
      </div>
      <Card><CardHeader><h2 className="font-semibold">Recent founder submissions</h2></CardHeader><CardBody>
        {submissions.length ? <ul className="divide-y divide-line">{submissions.slice(0,8).map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><Link className="font-medium" href={"/dashboard/investor/inbox/" + s.id}>{s.startup_name}</Link><p className="text-xs text-muted">{s.submission_type === "pitch" ? "Pitch submission" : "Introduction request"}</p></div><Badge>{s.status.replace(/_/g," ")}</Badge></li>)}</ul> : <p className="text-sm text-muted">Your inbox is ready. Founder requests will appear here when they arrive.</p>}
      </CardBody></Card>
    </div>;
  }

  if (application?.status === "pending") return <div className="max-w-2xl space-y-4"><h1 className="text-2xl font-bold">Investor Mode application</h1><Alert tone="info" title="Application under review">Buna staff are reviewing the application for {application.organization_name}. Investor tools unlock after approval.</Alert><Card><CardBody className="space-y-2 text-sm"><p><strong>Investor type:</strong> {application.investor_type.replace(/_/g," ")}</p><p><strong>Submitted:</strong> {new Date(application.created_at).toLocaleDateString()}</p><p><strong>Markets:</strong> {application.markets.join(", ") || "Not specified"}</p></CardBody></Card></div>;

  return <div className="max-w-3xl space-y-5">
    <div><p className="text-sm font-semibold text-primary-deep">Buna Investor Mode</p><h1 className="mt-1 text-3xl font-bold">Become part of the capital network.</h1><p className="mt-2 text-muted">Apply as an angel investor, fund, accelerator, or institutional investor. Approved accounts can manage their public profile, review founder pitches, and run a deal pipeline.</p></div>
    {application?.status === "rejected" ? <Alert tone="warning" title="Your previous application was not approved">{application.review_note || "You may submit a new application with additional information."}</Alert> : null}
    <InvestorApplicationForm existingInvestorId={investorId} />
    <p className="text-sm text-muted">Already approaching investors? <Link href="/dashboard/investor/submissions" className="font-medium underline">Track your investor connections</Link>.</p>
  </div>;
}
