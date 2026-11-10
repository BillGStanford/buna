import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal, listFounderSubmissions } from "@/lib/investors/queries";
import { InvestorApplicationForm } from "@/components/investors/investor-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Investor Portal", robots: { index: false } };

export default async function InvestorPortalPage({ searchParams }: { searchParams: Promise<{ investorId?: string }> }) {
  const profile = await requireProfile("/dashboard/investor-portal");
  const { investorId = "" } = await searchParams;
  const { application, investor } = await getInvestorPortal(profile.id);
  const submissions = await listFounderSubmissions(profile.id);

  return <div className="max-w-5xl space-y-6">
    <header className="border-b border-line pb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-deep">Buna capital network</p>
      <h1 className="mt-1 text-3xl font-bold">Investor Portal</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Every Buna member can use this page to find investors and manage introductions. Investor Mode is an additional, staff-approved workspace for people investing in startups.</p>
    </header>

    <section className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3" aria-label="How Investor Mode works">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">1 · Apply</p><p className="mt-1 text-sm text-muted">Share your professional identity and contact email. Extra investment preferences are optional.</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">2 · Review</p><p className="mt-1 text-sm text-muted">Buna staff review the application and supporting information before granting access.</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">3 · Explore</p><p className="mt-1 text-sm text-muted">Once approved, open Investor Desk to discover startups, manage a private pipeline, and review founder pitches.</p></div>
    </section>

    {investor ? <Alert tone="success" title="Investor Mode is active">Your account is approved. <Link href="/dashboard/investor" className="font-semibold underline">Open your Investor Mode workspace</Link>.</Alert>
      : application?.status === "pending" ? <Alert tone="info" title="Investor Mode application under review">Your application for {application.organization_name} is awaiting Buna staff review. Deal-flow tools unlock only after approval.</Alert>
      : application?.status === "rejected" ? <Alert tone="warning" title="Previous investor application not approved">{application.review_note || "You can submit an updated application with additional information."}</Alert> : null}

    <section className="grid gap-3 sm:grid-cols-3">
      <Card><CardBody><p className="text-sm text-muted">Introductions sent</p><p className="mt-1 text-3xl font-semibold tabular-nums">{submissions.length}</p></CardBody></Card>
      <Card><CardBody><p className="text-sm text-muted">Active conversations</p><p className="mt-1 text-3xl font-semibold tabular-nums">{submissions.filter((s) => !["declined","closed"].includes(s.status)).length}</p></CardBody></Card>
      <Card><CardBody><p className="text-sm text-muted">Awaiting a response</p><p className="mt-1 text-3xl font-semibold tabular-nums">{submissions.filter((s) => ["new","under_review"].includes(s.status)).length}</p></CardBody></Card>
    </section>

    <section className="space-y-3">
      <div className="border-b border-line pb-3"><h2 className="text-lg font-semibold">Your investor connections</h2><p className="mt-1 text-sm text-muted">Track every pitch and introduction request you have sent to an investor.</p></div>
      {submissions.length ? <ul className="divide-y divide-line rounded-xl border border-line">{submissions.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0"><p className="font-semibold">{s.startup_name}</p><p className="text-sm text-muted">To {s.investor?.name ?? "Investor"} · {new Date(s.created_at).toLocaleDateString()}</p></div>
        <Badge>{s.status.replace(/_/g," ")}</Badge>
        <Link href={"/dashboard/investor/conversations/" + s.id} className="text-sm font-medium underline">Open conversation</Link>
      </li>)}</ul> : <Card><CardBody className="space-y-2"><p className="font-medium">No introductions yet</p><p className="text-sm text-muted">Browse the investor directory, review each investor’s thesis and public contact details, then request an introduction or contact them directly.</p></CardBody></Card>}
    </section>

    <section className="grid gap-3 sm:grid-cols-2">
      <Card><CardHeader><h2 className="font-semibold">Discover the capital network</h2></CardHeader><CardBody className="space-y-3"><p className="text-sm text-muted">Find investors by geography, stage and sector. Review their public contact channels and stated investment focus.</p><Link href="/investors" className={buttonStyles("primary","md")}>Browse investor directory</Link></CardBody></Card>
      <Card><CardHeader><h2 className="font-semibold">Prepare your company</h2></CardHeader><CardBody className="space-y-3"><p className="text-sm text-muted">Keep your startup profile, fundraising status, pitch information and supporting materials current before approaching capital.</p><Link href="/startups" className={buttonStyles("secondary","md")}>Explore startup profiles</Link></CardBody></Card>
    </section>

    {!investor && application?.status !== "pending" ? <section className="space-y-3">
      <div className="border-b border-line pb-3"><h2 className="text-lg font-semibold">Apply for Investor Mode</h2><p className="mt-1 text-sm text-muted">Only verified and approved investor accounts receive access to investor-only deal-flow tools.</p></div>
      <InvestorApplicationForm existingInvestorId={investorId} />
    </section> : null}
  </div>;
}
