import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getInvestorPortal, listInvestorSubmissions } from "@/lib/investors/queries";
import { InvestorApplicationForm } from "@/components/investors/investor-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Investor Mode", robots: { index: false } };

const primaryTools = [
  { href: "/dashboard/investor/discover", title: "Discover startups", description: "Find companies by sector, location, stage, and fundraising status.", action: "Explore companies", number: "01" },
  { href: "/dashboard/investor/startups", title: "Your watchlist", description: "Keep a private shortlist of companies you want to follow.", action: "View saved startups", number: "02" },
  { href: "/dashboard/investor/pipeline", title: "Your pipeline", description: "Track prospects from first discovery through review and meetings.", action: "Manage pipeline", number: "03" },
  { href: "/dashboard/investor/inbox", title: "Founder inbox", description: "Review founder pitches and manage introduction conversations.", action: "Open inbox", number: "04" },
];

export default async function InvestorPortalPage() {
  const profile = await requireProfile("/dashboard/investor");
  const { application, investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor-portal");

  const submissions = await listInvestorSubmissions(investor.id);
  const supabase = await createClient();
  const [{ count: savedCount }, { count: pipelineCount }] = await Promise.all([
    supabase.from("investor_saved_startups").select("startup_id", { count: "exact", head: true }).eq("investor_id", investor.id),
    supabase.from("investor_deals").select("id", { count: "exact", head: true }).eq("investor_id", investor.id),
  ]);
  const newRequests = submissions.filter((submission) => submission.status === "new").length;
  const activeConversations = submissions.filter((submission) => !["declined", "closed"].includes(submission.status)).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-deep">Your capital network workspace</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Welcome, {investor.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Everything you need to discover African startups, keep track of promising companies, and connect with founders.</p>
        </div>
        <Badge tone={investor.verification_status === "verified" ? "green" : "warning"}>
          {investor.verification_status === "verified" ? "Verified investor" : "Investor approval active"}
        </Badge>
      </header>

      <section aria-label="Workspace summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Saved startups", value: savedCount ?? 0, note: "Your private watchlist", href: "/dashboard/investor/startups" },
          { label: "Pipeline", value: pipelineCount ?? 0, note: "Companies you are tracking", href: "/dashboard/investor/pipeline" },
          { label: "Founder requests", value: submissions.length, note: "Pitches and introductions", href: "/dashboard/investor/inbox" },
          { label: "New requests", value: newRequests, note: "Waiting for your review", href: "/dashboard/investor/inbox" },
        ].map((metric) => (
          <Link key={metric.label} href={metric.href} className="rounded-xl border border-line bg-surface p-4 no-underline transition-colors hover:border-primary/40 hover:bg-primary-pale/30">
            <p className="text-sm text-muted">{metric.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{metric.value}</p>
            <p className="mt-1 text-xs text-muted">{metric.note}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <div className="border-b border-line pb-3">
          <h3 className="text-lg font-semibold">Your next step</h3>
          <p className="mt-1 text-sm text-muted">You do not need to configure everything before getting started.</p>
        </div>
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <p className="font-semibold">Find companies that fit your investment interests</p>
              <p className="mt-1 text-sm text-muted">Start with a broad search. You can narrow it by country, sector, stage, funding round, or target amount whenever you need to.</p>
            </div>
            <Link href="/dashboard/investor/discover" className={buttonStyles("primary", "md")}>Discover startups</Link>
          </CardBody>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="border-b border-line pb-3">
          <h3 className="text-lg font-semibold">Your workspace</h3>
          <p className="mt-1 text-sm text-muted">Four main tools. Each has one clear job.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {primaryTools.map((tool) => (
            <Card key={tool.href} className="h-full">
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.12em] text-primary-deep">{tool.number}</span>
                  <span className="text-xs text-muted">Investor Desk</span>
                </div>
                <div>
                  <h3 className="font-semibold">{tool.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{tool.description}</p>
                </div>
                <div className="mt-auto pt-1"><Link href={tool.href} className="text-sm font-semibold text-primary-deep underline underline-offset-4">{tool.action} →</Link></div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
          <div><h3 className="text-lg font-semibold">Recent founder activity</h3><p className="mt-1 text-sm text-muted">The latest pitches and introduction requests sent to you.</p></div>
          <Link href="/dashboard/investor/inbox" className="text-sm font-medium underline">View all</Link>
        </div>
        {submissions.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {submissions.slice(0, 6).map((submission) => (
              <li key={submission.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link className="font-semibold" href={"/dashboard/investor/inbox/" + submission.id}>{submission.startup_name}</Link>
                  <p className="mt-1 text-xs text-muted">{submission.submission_type === "pitch" ? "Founder pitch" : "Introduction request"} · {new Date(submission.created_at).toLocaleDateString()}</p>
                  {submission.summary ? <p className="mt-1 line-clamp-2 text-sm text-muted">{submission.summary}</p> : null}
                </div>
                <Badge tone={submission.status === "new" ? "green" : "neutral"}>{submission.status.replace(/_/g, " ")}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <Card><CardBody className="space-y-1">
            <p className="font-medium">Your inbox is ready</p>
            <p className="text-sm text-muted">Founder pitches and introduction requests will appear here. You can start discovering companies in the meantime.</p>
          </CardBody></Card>
        )}
      </section>

      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold">More investor tools and what they do</summary>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><p className="font-medium">Saved searches</p><p className="mt-1 text-muted">Store filters and enable alerts for newly matching companies.</p><Link className="mt-1 inline-block underline" href="/dashboard/investor/searches">Manage saved searches</Link></div>
          <div><p className="font-medium">Data rooms</p><p className="mt-1 text-muted">View confidential files only after a startup approves your access request.</p><Link className="mt-1 inline-block underline" href="/dashboard/investor/data-rooms">Open data rooms</Link></div>
          <div><p className="font-medium">Investor profile</p><p className="mt-1 text-muted">Manage the information founders see about your investment focus.</p><Link className="mt-1 inline-block underline" href="/dashboard/investor/profile">Edit your profile</Link></div>
          <div><p className="font-medium">Public profile</p><p className="mt-1 text-muted">See how your investor profile appears to founders and other members.</p><Link className="mt-1 inline-block underline" href={"/investors/" + investor.slug}>View public profile</Link></div>
        </div>
      </details>
    </div>
  );
}
