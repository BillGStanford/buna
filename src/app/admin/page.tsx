import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { getOverview } from "@/lib/admin/queries";
import { isAdmin } from "@/lib/permissions";

export default async function AdminHome() {
  const staff = await requireStaff();
  const o = await getOverview();
  if (!o) return <Alert tone="error" title="Couldn’t load the overview">The database didn’t answer. Try again in a moment.</Alert>;
  const queues: { label: string; value: number; href: string; adminOnly?: boolean; urgent?: boolean }[] = [
    { label: "Open reports", value: o.reports_open, href: "/admin/reports", urgent: true },
    { label: "Launches awaiting review", value: o.launches_pending, href: "/admin/launches", urgent: true },
    { label: "Startups awaiting review", value: o.startups_pending, href: "/admin/startups?status=pending_review", urgent: true },
    { label: "Verification requests", value: o.verifications_pending, href: "/admin/verification", adminOnly: true, urgent: true },
    { label: "New messages", value: o.messages_new, href: "/admin/messages" },
    { label: "Stale opportunities (30+ days unchecked)", value: o.opportunities_stale, href: "/admin/opportunities" },
  ].filter((q) => !q.adminOnly || isAdmin(staff.role));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">Admin</h1><Badge tone="green">{staff.role}</Badge></div>
      <section aria-labelledby="queues" className="space-y-3">
        <h2 id="queues" className="text-lg font-semibold">Needs attention</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((q) => (
            <li key={q.label}><Link href={q.href} className="block rounded-lg border border-line bg-surface p-4 no-underline hover:border-primary/40 hover:bg-primary-pale">
              <p className="text-sm text-muted">{q.label}</p><p className={`mt-1 text-3xl font-bold tabular-nums ${q.urgent && q.value > 0 ? "text-primary-deep" : "text-ink"}`}>{q.value}</p>
            </Link></li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="platform" className="space-y-3">
        <h2 id="platform" className="text-lg font-semibold">Platform</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[["Accounts", o.users], ["Suspended accounts", o.users_suspended], ["Published startups", o.startups_published]].map(([l, v]) => (
            <li key={String(l)}><Card><CardBody><p className="text-sm text-muted">{l}</p><p className="mt-1 text-3xl font-bold tabular-nums">{v}</p></CardBody></Card></li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="work-marketplace" className="space-y-3"><h2 id="work-marketplace" className="text-lg font-semibold">Work marketplace</h2><Link href="/admin/work" className="block rounded-lg border border-line bg-surface p-4 no-underline hover:border-primary/40 hover:bg-primary-pale"><p className="font-semibold">Manage Buna Work</p><p className="mt-1 text-sm text-muted">Review project reports, pause inappropriate listings and resolve contract disputes.</p></Link></section>
    </div>
  );
}
