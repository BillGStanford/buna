import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Pagination } from "@/components/startups/pagination";
import { NoteActionForm } from "@/components/admin/note-action-form";
import { ADMIN_PAGE, listStartupsAdmin } from "@/lib/admin/queries";
import { STATUS_LABELS } from "@/lib/startups/constants";
import { sanitizeSearchTerm } from "@/lib/startups/params";
import { moderateStartupAction } from "../actions";

export const metadata: Metadata = { title: "Startups (admin)" };
const STATUSES = ["draft", "pending_review", "published", "unpublished", "rejected", "removed"];

export default async function AdminStartupsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "";
  const q = sanitizeSearchTerm(sp.q ?? "");
  const parsed = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 1;
  const { rows, total } = await listStartupsAdmin(status, q, page);
  const href = (n: number) => `/admin/startups?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`;
  const act = (id: string, action: string) => ({ startupId: id, action });
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-semibold tracking-tight">Startups</h1><p className="mt-1 text-sm text-muted">Review, unpublish, remove and feature. Every decision is audited and the team is notified.</p></div>
      <form action="/admin/startups" method="get" role="search" aria-label="Filter startups" className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="st-q" className="mb-1 block text-sm font-medium">Name</label><input id="st-q" name="q" defaultValue={q} className="h-10 rounded-md border border-line px-3 text-sm" /></div>
        <div><label htmlFor="st-s" className="mb-1 block text-sm font-medium">Status</label><select id="st-s" name="status" defaultValue={status} className="h-10 rounded-md border border-line px-3 text-sm"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]?.label ?? s}</option>)}</select></div>
        <button type="submit" className={buttonStyles("secondary", "md")}>Filter</button>
      </form>
      <p className="text-sm text-muted"><span className="tabular-nums">{total}</span> startups</p>
      <ul className="space-y-3">
        {rows.map((s) => {
          const st = STATUS_LABELS[s.status] ?? { label: s.status, tone: "neutral" as const };
          return (
            <li key={s.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/startups/${s.slug}`} className="font-semibold">{s.name}</Link><Badge tone={st.tone}>{st.label}</Badge>
                {s.is_featured ? <Badge tone="green">featured</Badge> : null}{s.verification_status === "verified" ? <Badge tone="green">verified</Badge> : null}{s.is_demo ? <Badge tone="warning">demo</Badge> : null}
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {s.status === "pending_review" ? (<>
                  <NoteActionForm action={moderateStartupAction} fields={act(s.id, "approve")} button="Approve" variant="primary" />
                  <NoteActionForm action={moderateStartupAction} fields={act(s.id, "reject")} button="Send back with note" variant="danger" noteLabel="What needs to change (the team sees this)" required />
                </>) : null}
                {s.status === "published" ? (<>
                  <div className="flex flex-wrap gap-2">
                    <NoteActionForm action={moderateStartupAction} fields={act(s.id, s.is_featured ? "unfeature" : "feature")} button={s.is_featured ? "Unfeature" : "Feature"} />
                    <NoteActionForm action={moderateStartupAction} fields={act(s.id, "unpublish")} button="Unpublish" />
                  </div>
                </>) : null}
                {s.status === "removed" || s.status === "rejected" ? <NoteActionForm action={moderateStartupAction} fields={act(s.id, "restore")} button="Restore (as unpublished)" /> : null}
                {s.status !== "removed" ? <details className="sm:col-span-2"><summary className="cursor-pointer text-sm font-medium text-danger">Remove from Buna…</summary><div className="mt-2 max-w-md"><NoteActionForm action={moderateStartupAction} fields={act(s.id, "remove")} button="Remove startup" variant="danger" noteLabel="Reason (kept in the audit log; the team sees it)" /></div></details> : null}
              </div>
            </li>
          );
        })}
        {rows.length === 0 ? <li className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">No startups match.</li> : null}
      </ul>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / ADMIN_PAGE))} hrefFor={href} />
    </div>
  );
}
