import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Eye, ExternalLink, FileText, ImagePlus, Settings2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { LogoForm } from "@/components/startups/manage/logo-form";
import { StartupProfileForm } from "@/components/startups/manage/startup-profile-form";
import { PublishPanel } from "@/components/startups/manage/publish-panel";
import { requireProfile, getUser } from "@/lib/auth/session";
import { getManagedStartup, listCategories } from "@/lib/startups/queries";
import { publishReadiness } from "@/lib/startups/readiness";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Company editor" };

const sections = [
  { id: "identity", label: "Identity", hint: "Name, logo and website", icon: ImagePlus },
  { id: "overview", label: "Overview", hint: "Description, problem and solution", icon: FileText },
  { id: "market", label: "Market", hint: "Customers and business model", icon: ArrowRight },
  { id: "details", label: "Company details", hint: "Sector, stage and location", icon: Settings2 },
];

export default async function StartupProfileEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}`);
  const managed = await getManagedStartup(id, profile.id);
  if (!managed) notFound();
  const [categories, user] = await Promise.all([listCategories(), getUser()]);
  const s = managed.startup;
  const readiness = publishReadiness(s);
  const checks = [
    { label: "Company name", done: Boolean(s.name?.trim()), href: "#identity" },
    { label: "One-line description", done: Boolean(s.tagline?.trim()), href: "#overview" },
    { label: "About your company", done: Boolean(s.description?.trim()), href: "#overview" },
    { label: "Industry / sector", done: Boolean(s.category_id), href: "#details" },
    { label: "Country of operation", done: Boolean(s.country), href: "#details" },
    { label: "Company logo", done: Boolean(s.logo_url), href: "#identity" },
    { label: "Email address confirmed", done: Boolean(user?.email_confirmed_at), href: "/dashboard/security" },
  ];
  const completed = checks.filter((c) => c.done).length;
  const percent = Math.round((completed / checks.length) * 100);
  const previewHref = `/startups/${s.slug}`;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-primary-deep">Company editor</p><h2 className="mt-1 text-2xl font-bold">Build your company page</h2><p className="mt-1 max-w-2xl text-sm text-muted">Finish the steps below to prepare your company for review. Your draft stays private while you add information and upload images.</p></div>
        <Link href={previewHref} className={buttonStyles("secondary","md")}><Eye className="h-4 w-4"/>{s.status === "published" ? "View public page" : "Preview page"}<ExternalLink className="h-3.5 w-3.5"/></Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardBody className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Your publication checklist</h3><p className="mt-1 text-sm text-muted">A clear profile helps people understand your company.</p></div><Badge tone={percent === 100 ? "green" : "warning"}>{completed} of {checks.length} complete</Badge></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: percent + "%" }}/></div>
              <ul className="grid gap-2 sm:grid-cols-2">{checks.map((item)=><li key={item.label}><Link href={item.href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm no-underline hover:bg-surface-secondary">{item.done?<CheckCircle2 className="h-4 w-4 shrink-0 text-success"/>:<Circle className="h-4 w-4 shrink-0 text-muted"/>}<span className={item.done?"text-muted":"font-medium text-ink"}>{item.label}</span></Link></li>)}</ul>
              {readiness.missing.length ? <p className="text-xs text-muted">You can save your draft at any time. Publishing stays locked until every required item—including your company logo—is complete.</p> : null}
            </CardBody>
          </Card>

          <Card id="identity"><CardHeader><h3 className="font-semibold">Company identity</h3><p className="text-sm text-muted">Your name and logo help people recognize you across Buna.</p></CardHeader><CardBody className="space-y-4"><LogoForm startupId={s.id} name={s.name} logoUrl={s.logo_url} websiteUrl={s.website_url}/></CardBody></Card>

          <Card id="profile-details"><CardHeader><h3 className="font-semibold">Company information</h3><p className="text-sm text-muted">You don’t need every answer to save a draft. Fill in the essentials, then add more detail over time.</p></CardHeader><CardBody className="pt-5"><nav aria-label="Company editor sections" className="sticky top-16 z-20 -mx-1 mb-6 flex gap-1 overflow-x-auto border-y border-line bg-canvas/95 px-1 py-2 backdrop-blur">{sections.map((item)=>{const Icon=item.icon;return <a key={item.id} href={`#${item.id}`} className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted no-underline hover:bg-surface hover:text-ink"><Icon className="h-3.5 w-3.5"/>{item.label}</a>})}</nav><StartupProfileForm startup={s} categories={categories}/></CardBody></Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card><CardHeader><h3 className="font-semibold">Publishing</h3><p className="text-sm text-muted">Your draft is private until you publish it.</p></CardHeader><CardBody><PublishPanel startup={s} canPublish={["owner","admin"].includes(managed.role)} emailVerified={Boolean(user?.email_confirmed_at)}/></CardBody></Card>
          <Card><CardBody className="space-y-3 p-4"><h3 className="font-semibold">A good company page includes</h3><ul className="space-y-2 text-sm text-muted"><li>• A specific one-line description</li><li>• A clear explanation of the problem</li><li>• What your product or service does</li><li>• Who you build for and where</li><li>• A working website and recognizable logo</li></ul><div className="flex flex-wrap gap-3"><Link href={`/dashboard/startup/${id}/images`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-deep">Add product images <ImagePlus className="h-3.5 w-3.5"/></Link><Link href={`/dashboard/startup/${id}/products`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-deep">Add products <ArrowRight className="h-3.5 w-3.5"/></Link></div></CardBody></Card>
        </aside>
      </div>
    </div>
  );
}
