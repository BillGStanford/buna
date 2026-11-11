import Link from "next/link";
import { ArrowUpRight, ClipboardList, Users, Building2, ShieldAlert, MessageSquare } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireStaff } from "@/lib/auth/session";
import { getOverview } from "@/lib/admin/queries";
import { isAdmin } from "@/lib/permissions";

export default async function AdminHome() {
  const staff = await requireStaff();
  const o = await getOverview();
  if (!o) return <Alert tone="error" title="Couldn’t load the overview">The database didn’t answer. Try again in a moment.</Alert>;
  const queues: { label: string; description: string; value: number; href: string; adminOnly?: boolean; urgent?: boolean }[] = [
    { label: "Open reports", description: "Member and content reports", value: o.reports_open, href: "/admin/reports", urgent: true },
    { label: "Launches awaiting review", description: "Submissions waiting for a decision", value: o.launches_pending, href: "/admin/launches", urgent: true },
    { label: "Startups awaiting review", description: "New company submissions", value: o.startups_pending, href: "/admin/startups?status=pending_review", urgent: true },
    { label: "Verification requests", description: "Evidence-based company checks", value: o.verifications_pending, href: "/admin/verification", adminOnly: true, urgent: true },
    { label: "New messages", description: "Unread staff inbox items", value: o.messages_new, href: "/admin/messages" },
    { label: "Stale opportunities", description: "Not checked in 30+ days", value: o.opportunities_stale, href: "/admin/opportunities" },
  ].filter((q) => !q.adminOnly || isAdmin(staff.role));
  const urgentTotal = queues.filter((q) => q.urgent).reduce((sum, q) => sum + q.value, 0);
  const metrics = [
    { label: "Registered accounts", value: o.users, Icon: Users },
    { label: "Published startups", value: o.startups_published, Icon: Building2 },
    { label: "Suspended accounts", value: o.users_suspended, Icon: ShieldAlert },
  ];
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Operations / Overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Good work starts with clarity.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Your staff command centre. Review the queues, resolve member issues and keep Buna’s startup network trustworthy.</p></div>
        <Badge tone="green">{staff.role} access</Badge>
      </header>

      <section aria-labelledby="attention-heading" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-pale text-primary"><ClipboardList className="h-4 w-4"/></span><div><h2 id="attention-heading" className="text-sm font-semibold text-ink">Work queue</h2><p className="mt-0.5 text-xs text-muted">Items that may need staff attention</p></div></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${urgentTotal ? "bg-amber-50 text-amber-800" : "bg-primary-pale text-primary-deep"}`}>{urgentTotal} priority items</span>
        </div>
        <ul className="divide-y divide-line">
          {queues.map((q) => <li key={q.label}><Link href={q.href} className="group flex items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-surface-subtle sm:px-6">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${q.urgent && q.value > 0 ? "bg-amber-50 text-amber-700" : "bg-surface-subtle text-muted"}`}><ClipboardList className="h-4 w-4"/></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{q.label}</span><span className="mt-0.5 block text-xs text-muted">{q.description}</span></span>
            <span className={`min-w-10 text-right text-xl font-semibold tabular-nums ${q.urgent && q.value > 0 ? "text-amber-700" : "text-ink"}`}>{q.value}</span>
            <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"/>
          </Link></li>)}
        </ul>
      </section>

      <section aria-labelledby="platform-heading" className="space-y-3">
        <div><h2 id="platform-heading" className="text-sm font-semibold text-ink">Platform snapshot</h2><p className="mt-1 text-xs text-muted">Current account and startup totals</p></div>
        <div className="grid gap-3 sm:grid-cols-3">{metrics.map(({label,value,Icon}) => <div key={label} className="rounded-2xl border border-line bg-surface p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted">{label}</span><Icon className="h-4 w-4 text-muted"/></div><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-ink">{value.toLocaleString()}</p></div>)}</div>
      </section>

      <section aria-labelledby="network-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Founder network</p><h2 id="network-heading" className="mt-1 text-lg font-semibold tracking-tight">Co-Founder Discovery</h2><p className="mt-1 max-w-xl text-sm text-muted">Review opt-in profiles before they become visible to other approved members.</p></div><Link href="/admin/cofounders" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-primary-deep">Open review queue <ArrowUpRight className="h-4 w-4"/></Link></div>
      </section>
    </div>
  );
}
