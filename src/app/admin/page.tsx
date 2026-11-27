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
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">Use this guide to understand each area before changing anything. Each section explains its purpose, the work you do there, and the result you should expect.</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">1. Review and protect the ecosystem</h3>
            <p className="mt-1 text-sm text-muted">Check content submitted by founders and community members.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/reports">Reports</Link><p className="text-muted">Investigate reported content or accounts. Review the evidence, then resolve the report using the appropriate moderation action.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/startups">Startups</Link><p className="text-muted">Review startup submissions, search listings and manage their publication status.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/launches">Launches</Link><p className="text-muted">Review launch submissions before they appear in launch discovery; manage approval and published launches.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/community">Community</Link><p className="text-muted">Moderate discussion threads and replies; hide, restore or remove content when appropriate.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/opportunities">Opportunities</Link><p className="text-muted">Check grants, accelerators and founder opportunities for accuracy, relevance and current deadlines.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/investors">Investors</Link><p className="text-muted">Maintain investor directory entries so public investor information stays trustworthy.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/featured">Featured</Link><p className="text-muted">Choose published startups for editorial visibility in discovery.</p></li>
            </ul>
          </article>
          <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">2. Manage people and relationships</h3>
            <p className="mt-1 text-sm text-muted">Help users and manage requests connected to their accounts.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/users">Users</Link><p className="text-muted">Find accounts, inspect status, suspend or restore access. Admins can manage platform roles where permitted.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/messages">Messages</Link><p className="text-muted">Read contact messages and mark them handled or spam.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/investor-applications">Investor applications</Link><p className="text-muted">Review identity, background, track record and evidence before deciding on investor access.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/referral-rewards">Referral rewards</Link><p className="text-muted">Check eligibility and referral history before approving reward requests.</p></li>
            </ul>
          </article>
          <article className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">3. Maintain company intelligence</h3>
            <p className="mt-1 text-sm text-muted">Keep the underlying directory accurate and evidence-based.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/company-data">Company data</Link><p className="text-muted">Review founder-reported or disputed company claims, metrics and funding-round information against their evidence.</p></li>
              <li><Link className="font-semibold text-primary hover:underline" href="/admin/company-sources">Data sources</Link><p className="text-muted">Manage source records and assess proposed company matches before accepting them into the data workflow.</p></li>
              {isAdmin(staff.role) ? <>
                <li><Link className="font-semibold text-primary hover:underline" href="/admin/categories">Categories</Link><p className="text-muted">Manage broad sectors used to organize startups, launches and discovery filters.</p></li>
                <li><Link className="font-semibold text-primary hover:underline" href="/admin/tags">Tags</Link><p className="text-muted">Maintain the shared, specific labels used to describe and filter platform content.</p></li>
              </> : null}
            </ul>
          </article>
          {isAdmin(staff.role) ? <>
            <article className="rounded-xl border border-line bg-surface p-4">
              <h3 className="font-semibold">4. Run platform operations</h3>
              <p className="mt-1 text-sm text-muted">Handle support, disputes and bulk tasks outside the normal review queues.</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="font-semibold text-primary hover:underline" href="/admin/operations">Operations</Link><p className="text-muted">Manage support tickets, user disputes, company corrections, duplicate startup merges, bulk startup and opportunity imports, scheduled announcements, featured campaigns and the admin activity dashboard.</p></li>
                <li><Link className="font-semibold text-primary hover:underline" href="/admin/verification">Verification</Link><p className="text-muted">Inspect startup verification evidence and approve, reject or revoke verification when justified.</p></li>
              </ul>
            </article>
            <article className="rounded-xl border border-line bg-surface p-4">
              <h3 className="font-semibold">5. Measure and audit</h3>
              <p className="mt-1 text-sm text-muted">Understand performance and maintain accountability.</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="font-semibold text-primary hover:underline" href="/admin/analytics">Analytics</Link><p className="text-muted">Review visitor, signup, onboarding and launch activity to understand platform trends.</p></li>
                <li><Link className="font-semibold text-primary hover:underline" href="/admin/audit">Audit log</Link><p className="text-muted">Trace administrative actions by actor, affected record and timestamp.</p></li>
              </ul>
            </article>
            <article className="rounded-xl border border-line bg-surface p-4">
              <h3 className="font-semibold">6. Configure Buna</h3>
              <p className="mt-1 text-sm text-muted">These controls can affect platform-wide behavior.</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="font-semibold text-primary hover:underline" href="/admin/settings">Settings</Link><p className="text-muted">Change platform policies such as whether new startup submissions require review. Changes apply to future behavior and are audited.</p></li>
                <li><span className="font-semibold">Roles and access</span><p className="text-muted">Grant elevated roles only to trusted staff. Moderators handle assigned review work; admins have broader platform controls.</p></li>
              </ul>
            </article>
          </> : null}
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary-pale/50 p-4">
          <h3 className="font-semibold text-ink">A safe way to work</h3>
          <ol className="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li><strong className="text-ink">1. Start with Overview.</strong> Check queues and prioritize urgent reports or pending reviews.</li>
            <li><strong className="text-ink">2. Open the relevant section.</strong> Read the record and supporting evidence before acting.</li>
            <li><strong className="text-ink">3. Choose the narrowest action.</strong> Resolve the specific issue rather than making broad changes.</li>
            <li><strong className="text-ink">4. Verify the result.</strong> Check the public listing or account state; use the audit log to confirm administrative changes.</li>
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-muted">Suspensions, merges, imports, announcements and settings changes have real effects. Use test records when learning a workflow and double-check before confirming.</p>
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
