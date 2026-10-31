import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { SubNav } from "@/components/dashboard/sub-nav";
import { StartupLogo } from "@/components/startups/startup-logo";
import { requireProfile } from "@/lib/auth/session";
import { canEditStartup } from "@/lib/permissions";
import { STATUS_LABELS } from "@/lib/startups/constants";
import { getManagedStartup } from "@/lib/startups/queries";
import { uuidField } from "@/lib/validation/startup";

export default async function ManageStartupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidField.safeParse(id).success) notFound();
  const profile = await requireProfile(`/dashboard/startup/${id}`);
  const managed = await getManagedStartup(id, profile.id);
  if (!managed) notFound();
  if (!canEditStartup(managed.role)) redirect("/forbidden");
  const s = managed.startup;
  const status = STATUS_LABELS[s.status] ?? { label: s.status, tone: "neutral" as const };
  const base = `/dashboard/startup/${id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <StartupLogo name={s.name} src={s.logo_url} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-sm"><Link href="/dashboard/startup" className="font-medium">My startups</Link></p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{s.name}</h1><Badge tone={status.tone}>{status.label}</Badge>
            {s.is_demo ? <Badge tone="warning">Demo</Badge> : null}
          </div>
        </div>
        <Link href={`/startups/${s.slug}`} className={buttonStyles("secondary", "md")}>
          {s.status === "published" ? "View public page" : "Preview"}<ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <SubNav label="Startup sections" items={[
        { label: "Profile", href: base, exact: true },
        { label: "Products", href: `${base}/products` },
        { label: "Links", href: `${base}/links` },
        { label: "Team", href: `${base}/team` },
        { label: "Analytics", href: `${base}/analytics` },
        { label: "Screenshots", href: `${base}/images` },
        { label: "Verification", href: `${base}/verification` },
        { label: "Publishing", href: `${base}/settings` },
      ]} />
      {children}
    </div>
  );
}
