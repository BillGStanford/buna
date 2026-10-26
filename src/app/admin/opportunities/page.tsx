import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { OpportunityRowActions } from "@/components/admin/opportunity-row-actions";
import { formatDate } from "@/lib/format";
import { OPPORTUNITY_STATUSES, categoryLabel } from "@/lib/opportunities/constants";
import { deadlineState, describeDeadline } from "@/lib/opportunities/params";
import { listForAdmin } from "@/lib/opportunities/queries";
import { sanitizeSearchTerm } from "@/lib/startups/params";

export const metadata: Metadata = { title: "Opportunities (admin)" };

export default async function AdminOpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = OPPORTUNITY_STATUSES.some((s) => s.value === sp.status) ? (sp.status ?? "") : "";
  const q = sanitizeSearchTerm(sp.q ?? "");
  const rows = await listForAdmin(status, q);
  const stale = Date.now() - 30 * 86_400_000;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm"><Link href="/admin" className="font-medium">Admin</Link></p><h1 className="text-2xl font-bold">Opportunities</h1></div>
        <Link href="/admin/opportunities/new" className={buttonStyles("primary", "md")}><Plus className="h-4 w-4" aria-hidden="true" />New opportunity</Link>
      </div>
      <form action="/admin/opportunities" method="get" className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter opportunities">
        <div><label htmlFor="op-q" className="mb-1 block text-sm font-medium">Title</label><input id="op-q" name="q" defaultValue={q} className="h-10 rounded-md border border-line px-3 text-sm" /></div>
        <div><label htmlFor="op-s" className="mb-1 block text-sm font-medium">Status</label><select id="op-s" name="status" defaultValue={status} className="h-10 rounded-md border border-line px-3 text-sm"><option value="">All</option>{OPPORTUNITY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <button type="submit" className={buttonStyles("secondary", "md")}>Filter</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Opportunities</caption>
          <thead className="bg-primary-pale"><tr><th scope="col" className="p-3">Listing</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Deadline</th><th scope="col" className="p-3">Last checked</th><th scope="col" className="p-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => {
              const checked = o.last_checked_at ? new Date(o.last_checked_at).getTime() : 0;
              return (
                <tr key={o.id}>
                  <td className="p-3"><Link href={`/admin/opportunities/${o.id}`} className="font-medium">{o.title}</Link><p className="text-xs text-muted">{o.organization} · {categoryLabel(o.category)}{o.is_demo ? " · demo" : ""}</p></td>
                  <td className="p-3"><Badge tone={o.status === "published" ? "green" : o.status === "expired" ? "danger" : "neutral"}>{o.status}</Badge></td>
                  <td className="p-3 tabular-nums">{o.deadline ? formatDate(o.deadline) : "—"}<p className="text-xs text-muted">{describeDeadline(deadlineState(o.status, o.deadline))}</p></td>
                  <td className="p-3 tabular-nums">{o.last_checked_at ? formatDate(o.last_checked_at) : "never"}{checked < stale && o.status === "published" ? <Badge tone="warning" className="ml-2">stale</Badge> : null}</td>
                  <td className="p-3"><OpportunityRowActions opportunityId={o.id} status={o.status} /></td>
                </tr>
              );
            })}
            {rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted">No opportunities match.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
