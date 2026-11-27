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
      <div className="flex flex-wrap items-center gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Workspace</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Overview</h2><p className="mt-1 text-sm text-muted">A live view of the queues and platform activity that need staff attention.</p></div><Badge tone="green">{staff.role}</Badge></div>
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
      <section aria-labelledby="guide" className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Admin handbook</p>
          <h2 id="guide" className="mt-1 text-lg font-semibold">What can I do here?</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">Use this guide to understand each area before changing anything. Open a section to review its purpose, the work you do there, and the result you should expect.</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">1. Review and protect the ecosystem</h3>
            <p className="mt-1 text-sm text-muted">These sections are for checking content submitted by founders and community members.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/reports">Reports</Link><p className="text-muted">Investigate reported content or accounts. Review the evidence, then resolve the report using the appropriate moderation action.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/startups">Startups</Link><p className="text-muted">Review startup listings, correct inaccurate information, and manage their publication or verification status.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/launches">Launches</Link><p className="text-muted">Review launch submissions before they appear in launch discovery; manage their approval and featured status.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/community">Community</Link><p className="text-muted">Moderate discussion and user-generated community content when it violates platform rules.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/opportunities">Opportunities</Link><p className="text-muted">Check grants, accelerators and founder opportunities for accuracy, relevance and stale deadlines.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/investors">Investors</Link><p className="text-muted">Review investor directory entries and keep public investor information trustworthy.</p></li>
            </ul>
          </article>
          <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">2. Manage people and relationships</h3>
            <p className="mt-1 text-sm text-muted">Use these tools when you need to help an account or manage a platform relationship.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/users">Users</Link><p className="text-muted">Search for an account, inspect its status, and suspend or restore access when justified.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/messages">Messages</Link><p className="text-muted">Review incoming platform messages and follow up on items that need staff attention.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/investor-applications">Investor applications</Link><p className="text-muted">Assess applications and supporting details before granting investor-related approval.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/referral-rewards">Referral rewards</Link><p className="text-muted">Review referral activity and reward eligibility before confirming a reward.</p></li>
            </ul>
          </article>
          <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">3. Maintain company intelligence</h3>
            <p className="mt-1 text-sm text-muted">Keep the underlying directory accurate so founders, investors and visitors can rely on it.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/company-data">Company data</Link><p className="text-muted">Inspect structured company records and resolve data-quality issues.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/company-sources">Data sources</Link><p className="text-muted">Track the sources used for company information and assess source reliability.</p></li>
              {isAdmin(staff.role) ? <><li><Link className="font-semibold text-primary hover:underline" href="/admin/categories">Categories</Link><p className="text-muted">Manage the broad categories used to organize startup discovery.</p></li><li><Link className="font-semibold text-primary hover:underline" href="/admin/tags">Tags</Link><p className="text-muted">Manage more specific labels that help people filter and find relevant listings.</p></li></> : null}
            </ul>
          </article> : null}
          {isAdmin(staff.role) ? <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">4. Run platform operations</h3>
            <p className="mt-1 text-sm text-muted">This is the operational toolkit for issues that do not fit ordinary content review.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/operations">Operations</Link><p className="text-muted">Manage support tickets, user disputes, company correction requests, duplicate startup merges, bulk startup and opportunity imports, scheduled announcements, featured campaigns and the admin activity dashboard.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/featured">Featured</Link><p className="text-muted">Manage featured startup placements and campaigns that give selected listings extra visibility.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/verification">Verification</Link><p className="text-muted">Inspect verification requests and supporting evidence, then approve or reject based on the published criteria.</p></li>
            </ul>
          </article> : null}
          {isAdmin(staff.role) ? <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">5. Measure and audit</h3>
            <p className="mt-1 text-sm text-muted">Use these sections to understand performance and maintain accountability.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/analytics">Analytics</Link><p className="text-muted">Understand platform activity and growth trends; use the numbers to identify what needs attention.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/audit">Audit log</Link><p className="text-muted">Trace administrative actions: who performed them, what record was affected and when.</p></li>
            </ul>
          </article>
          {isAdmin(staff.role) ? <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">6. Configure Buna (admin-only)</h3>
            <p className="mt-1 text-sm text-muted">These controls can affect the whole platform. Change them deliberately.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/settings">Settings</Link><p className="text-muted">Manage platform-wide configuration and administrative controls. Check the impact before saving changes.</p></li>
              <li><span className="font-semibold">Roles and access</span><p className="text-muted">Only grant administrative privileges to trusted staff. Moderators handle assigned review work; admins have broader platform controls.</p></li>
            </ul>
          </article> : null}
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary-pale/50 p-4">
          <h3 className="font-semibold text-ink">A safe way to work</h3>
          <ol className="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li><strong className="text-ink">1. Start with Overview.</strong> Check queues and prioritize urgent reports or pending reviews.</li>
            <li><strong className="text-ink">2. Open the relevant section.</strong> Read the record and supporting evidence before acting.</li>
            <li><strong className="text-ink">3. Choose the narrowest action.</strong> Prefer correcting or resolving the specific issue over broad account or content changes.</li>
            <li><strong className="text-ink">4. Verify the result.</strong> Check the public listing or account state, then use the audit log when you need to confirm who changed what.</li>
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-muted">Important: actions such as suspending accounts, merging startups, sending announcements, importing records and changing settings can have real effects. Use test records first when learning a workflow.</p>
        </div>
      </section>
      <section aria-labelledby="platform" className="space-y-3">
        <h2 id="platform" className="text-lg font-semibold">Platform</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[["Accounts", o.users], ["Suspended accounts", o.users_suspended], ["Published startups", o.startups_published]].map(([l, v]) => (
            <li key={String(l)}><Card><CardBody><p className="text-sm text-muted">{l}</p><p className="mt-1 text-3xl font-bold tabular-nums">{v}</p></CardBody></Card></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
