import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/illustrations";
import { Pagination } from "@/components/startups/pagination";
import { NoteActionForm } from "@/components/admin/note-action-form";
import { ADMIN_PAGE, listReports } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/startups/constants";
import { cn } from "@/lib/utils";
import { moderateCommentAction, moderateStartupAction, resolveReportAction } from "../actions";

export const metadata: Metadata = { title: "Reports (admin)" };
const TABS = [["active", "Open"], ["actioned", "Actioned"], ["dismissed", "Dismissed"]] as const;

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = TABS.some(([v]) => v === sp.status) ? sp.status! : "active";
  const parsed = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 1;
  const { rows, total } = await listReports(status, page);
  const href = (s: string, n = 1) => `/admin/reports?${new URLSearchParams({ status: s, ...(n > 1 ? { page: String(n) } : {}) })}`;
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-1 text-sm text-muted">Oldest first. Repeat reports on the same item are grouped by the “reports on this item” count; each person can report an item once.</p></div>
      <nav aria-label="Report status" className="flex gap-1 border-b border-line">{TABS.map(([v, l]) => <Link key={v} href={href(v)} aria-current={status === v ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium no-underline", status === v ? "border-primary text-primary-deep" : "border-transparent text-muted hover:text-ink")}>{l}</Link>)}</nav>
      {rows.length === 0 ? <EmptyState illustration="inbox" title={status === "active" ? "No reports waiting" : "Nothing here"}>{status === "active" ? "The queue is empty." : null}</EmptyState> : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}</Badge><Badge>{r.target_type}</Badge>
                {r.status === "reviewing" ? <Badge tone="green">reviewing</Badge> : null}
                <Badge tone={r.same_target_count > 1 ? "danger" : "neutral"}><span className="tabular-nums">{r.same_target_count}</span>&nbsp;reports on this item</Badge>
                {r.target_state ? <span className="text-xs text-muted">item is {r.target_state}</span> : null}
              </div>
              <p className="mt-2 text-sm">{r.target_url ? <Link href={r.target_url} className="font-medium">{r.target_label ?? "(deleted item)"}</Link> : <span className="text-muted">(item no longer exists)</span>}</p>
              {r.details ? <p className="mt-1 text-sm text-muted">“{r.details}”</p> : null}
              <p className="mt-1 text-xs text-muted">Reported by @{r.reporter_username ?? "unknown"} · <time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>{r.resolution_note ? <> · note: {r.resolution_note}</> : null}</p>
              {status === "active" ? (
                <div className="mt-3 grid gap-4 border-t border-line pt-3 md:grid-cols-2">
                  <div className="space-y-3">
                    {r.target_type === "comment" && r.target_state === "visible" ? <NoteActionForm action={moderateCommentAction} fields={{ commentId: r.target_id, action: "hide" }} button="Hide this comment" variant="danger" /> : null}
                    {r.target_type === "startup" && r.target_state !== "removed" ? <NoteActionForm action={moderateStartupAction} fields={{ startupId: r.target_id, action: "remove" }} button="Remove this startup" variant="danger" /> : null}
                    {r.target_type === "launch" ? <Link href="/admin/launches" className="text-sm font-medium">Open launch moderation</Link> : null}
                    {r.target_type === "user" ? <Link href={`/admin/users?q=${encodeURIComponent((r.target_label ?? "").replace(/^@/, ""))}`} className="text-sm font-medium">Open in user management</Link> : null}
                    {r.target_type === "opportunity" ? <Link href="/admin/opportunities" className="text-sm font-medium">Open opportunity management</Link> : null}
                    {r.target_type === "investor" ? <Link href="/admin/investors" className="text-sm font-medium">Open investor management</Link> : null}
                  </div>
                  <div className="space-y-2">
                    <NoteActionForm action={resolveReportAction} fields={{ reportId: r.id, status: "actioned" }} button="Mark actioned" variant="primary" noteLabel="What you did (optional)" />
                    <div className="flex flex-wrap gap-2">
                      {r.status === "open" ? <NoteActionForm action={resolveReportAction} fields={{ reportId: r.id, status: "reviewing" }} button="Mark reviewing" /> : null}
                      <NoteActionForm action={resolveReportAction} fields={{ reportId: r.id, status: "dismissed" }} button="Dismiss" variant="ghost" />
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / ADMIN_PAGE))} hrefFor={(n) => href(status, n)} />
    </div>
  );
}
