import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ChartNoAxesCombined, CircleCheck, Compass, Megaphone, Package, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { StartupWorkspaceSwitcher } from "@/components/dashboard/startup-workspace-switcher";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { listMyLaunches } from "@/lib/launches/queries";
import { listMyStartups } from "@/lib/startups/queries";
import { STATUS_LABELS } from "@/lib/startups/constants";
import { createClient } from "@/lib/supabase/server";
import { unreadInquiryCount } from "@/lib/inquiries/queries";
import { getInvestorPortal } from "@/lib/investors/queries";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Business workspace" };

async function count(table: string, column: string, userId: string) {
  const supabase = await createClient();
  const { count: n } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, userId);
  return n ?? 0;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile("/dashboard");
  await requireUser("/dashboard");
  const { notice, company } = await searchParams;
  if (profile.professional_role === "Investor") {
    const { investor, application } = await getInvestorPortal(profile.id);
    if (investor) redirect("/dashboard/investor");
    if (application?.status === "pending") redirect("/dashboard/investor-portal");
  }
  const firstName = profile.display_name.split(" ")[0];
  const [startups, launches, unreadInquiries, saved, following] = await Promise.all([
    listMyStartups(profile.id), listMyLaunches(profile.id), unreadInquiryCount(),
    count("saved_opportunities", "user_id", profile.id), count("follows", "follower_id", profile.id),
  ]);
  const primary = startups.find((startup) => startup.id === company) ?? startups[0] ?? null;
  const published = startups.filter((s) => s.status === "published").length;
  const draft = startups.filter((s) => s.status === "draft").length;
  const quickLinks = [
    { label: "Company profile", description: "Build and edit your public company page", href: primary ? `/dashboard/startup/${primary.id}` : "/dashboard/startup/new", icon: Building2 },
    { label: "Products & services", description: "Show people what you're building", href: primary ? `/dashboard/startup/${primary.id}/products` : "/dashboard/startup/new", icon: Package },
    { label: "Team", description: "Invite the people building with you", href: primary ? `/dashboard/startup/${primary.id}/team` : "/dashboard/startup/new", icon: Users },
    { label: "Updates & launches", description: "Share progress and introduce products", href: "/dashboard/launches", icon: Megaphone },
    { label: "Analytics", description: "Understand your company's audience", href: primary ? `/dashboard/startup/${primary.id}/analytics` : "/dashboard/startup/new", icon: ChartNoAxesCombined },
    { label: "Discover opportunities", description: "Explore the wider Buna ecosystem", href: "/opportunities", icon: Compass },
  ];
  const nextAction = !primary ? { title: "Create your company page", body: "Give your startup a home on Buna. Start with a website or enter the basics yourself.", href: "/dashboard/startup/new", cta: "Create your startup" }
    : primary?.status === "draft" ? { title: "Continue building your company page", body: "Your draft is saved. Add the missing details and preview it before publishing.", href: `/dashboard/startup/${primary.id}`, cta: "Continue profile" }
    : { title: "Give your community a reason to return", body: "Share a product update, milestone, or company announcement.", href: `/dashboard/startup/${primary.id}/updates`, cta: "Share an update" };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {notice === "password_updated" ? <div role="status" className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">Your password was updated.</div> : null}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-deep">Business workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome{firstName ? `, ${firstName}` : ""}.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Your company's home on Buna. Pick up where you left off or manage your business.</p>
        </div>
        <Link href="/dashboard/startup/new" className={buttonStyles("primary", "md")}><Plus className="h-4 w-4"/> Add a startup</Link>
      </header>

      <section aria-labelledby="next-step-heading" className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <Card className="overflow-hidden border-primary/20">
          <div className="h-1.5 bg-primary"/>
          <CardBody className="space-y-4 p-6">
            <Badge tone="success">Recommended next step</Badge>
            <div><h2 id="next-step-heading" className="text-2xl font-bold">{nextAction.title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">{nextAction.body}</p></div>
            <Link href={nextAction.href} className={buttonStyles("primary", "md")}>{nextAction.cta}<ArrowRight className="h-4 w-4"/></Link>
          </CardBody>
        </Card>
        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Your company snapshot</h2><p className="mt-1 text-xs text-muted">{primary ? `Viewing ${primary.name}` : "Across your managed startups"}</p></div>{primary ? <Badge tone={primary.status === "published" ? "success" : "warning"}>{STATUS_LABELS[primary.status]?.label ?? primary.status}</Badge> : null}</div></CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <div><p className="text-2xl font-bold tabular-nums">{startups.length}</p><p className="text-xs text-muted">Companies</p></div>
            <div><p className="text-2xl font-bold tabular-nums">{published}</p><p className="text-xs text-muted">Published</p></div>
            <div><p className="text-2xl font-bold tabular-nums">{draft}</p><p className="text-xs text-muted">Drafts</p></div>
            <div><p className="text-2xl font-bold tabular-nums">{unreadInquiries}</p><p className="text-xs text-muted">Unread inquiries</p></div>
          </CardBody>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="companies-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="companies-heading" className="text-lg font-semibold">Your companies</h2><p className="mt-1 text-sm text-muted">Choose a company to focus your workspace.</p></div><div className="flex items-center gap-3">{primary ? <StartupWorkspaceSwitcher startups={startups.filter((startup) => ["owner", "admin", "editor"].includes(startup.role))} activeStartupId={primary.id} returnTo="overview"/> : null}<Link href="/dashboard/startup" className="text-sm font-semibold text-primary-deep">Manage all <ArrowRight className="ml-1 inline h-3.5 w-3.5"/></Link></div></div>
        {startups.length === 0 ? <Card><CardBody className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Your first company starts here</h3><p className="mt-1 text-sm text-muted">Create a company profile in a few minutes. It stays private until you publish.</p></div><Link href="/dashboard/startup/new" className={buttonStyles("primary","md")}>Create company</Link></CardBody></Card> :
          <div className="grid gap-3 md:grid-cols-2">{startups.map((s)=>{const status=STATUS_LABELS[s.status]??{label:s.status,tone:"neutral" as const};return <Card key={s.id}><CardBody className="flex items-center gap-3 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-pale text-primary-deep"><Building2 className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{s.name}</h3><Badge tone={status.tone}>{status.label}</Badge></div><p className="mt-0.5 truncate text-sm text-muted">{s.tagline || "Add a short description to introduce your company."}</p></div><Link aria-label={`Manage ${s.name}`} href={`/dashboard/startup/${s.id}`} className={buttonStyles("secondary","sm")}>Manage</Link></CardBody></Card>})}</div>}
      </section>

      <section className="space-y-3" aria-labelledby="manage-heading">
        <div><h2 id="manage-heading" className="text-lg font-semibold">Manage your business</h2><p className="mt-1 text-sm text-muted">The tools you need, without getting in your way.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{quickLinks.map(({label,description,href,icon:Icon})=><Link key={label} href={href} className="group rounded-xl border border-line bg-surface p-4 no-underline transition hover:border-primary/40 hover:shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-pale text-primary-deep"><Icon className="h-4 w-4"/></span><ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary"/></div><h3 className="mt-3 font-semibold text-ink">{label}</h3><p className="mt-1 text-sm leading-5 text-muted">{description}</p></Link>)}</div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card><CardBody className="p-4"><p className="text-xs text-muted">Launches</p><p className="mt-1 text-2xl font-bold tabular-nums">{launches.length}</p><Link href="/dashboard/launches" className="mt-2 inline-block text-sm font-medium text-primary-deep">View launches</Link></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-muted">Following</p><p className="mt-1 text-2xl font-bold tabular-nums">{following}</p><Link href="/dashboard/following" className="mt-2 inline-block text-sm font-medium text-primary-deep">Manage following</Link></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-muted">Saved opportunities</p><p className="mt-1 text-2xl font-bold tabular-nums">{saved}</p><Link href="/dashboard/saved" className="mt-2 inline-block text-sm font-medium text-primary-deep">View saved</Link></CardBody></Card>
      </section>
      <p className="text-xs text-muted"><CircleCheck className="mr-1 inline h-3.5 w-3.5"/> Your company drafts are private. Only authorized team members can manage them.</p>
    </div>
  );
}
