import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/startups/pagination";
import { NoteActionForm } from "@/components/admin/note-action-form";
import { requireStaff } from "@/lib/auth/session";
import { ADMIN_PAGE, searchUsers } from "@/lib/admin/queries";
import { formatDate } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { sanitizeSearchTerm } from "@/lib/startups/params";
import { setUserRoleAction, suspendUserAction } from "../actions";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Users (admin)" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const q = sanitizeSearchTerm(sp.q ?? "");
  const parsed = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 1;
  const { rows, total } = await searchUsers(q, page);
  const admin = isAdmin(staff.role);
  const href = (n: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`;
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-semibold tracking-tight">Users</h1><p className="mt-1 text-sm text-muted">{admin ? "Search by name, username or email." : "Search by name or username. Email addresses are visible to admins only."}</p></div>
      <form action="/admin/users" method="get" role="search" aria-label="Search users" className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="user-q" className="mb-1 block text-sm font-medium">Search</label><input id="user-q" name="q" defaultValue={q} maxLength={80} className="h-10 rounded-md border border-line px-3 text-sm" /></div>
        <button type="submit" className={buttonStyles("secondary", "md")}>Search</button>
      </form>
      <p className="text-sm text-muted"><span className="tabular-nums">{total}</span> accounts</p>
      <ul className="space-y-3">
        {rows.map((u) => (
          <li key={u.id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <strong><Link href={`/users/${u.username}`} className="text-ink no-underline hover:underline">{u.display_name || `@${u.username}`}</Link></strong><span className="text-sm text-muted"><Link href={`/users/${u.username}`} className="no-underline hover:underline">@{u.username}</Link></span>
              <Badge tone={u.role === "user" ? "neutral" : "green"}>{u.role}</Badge>{u.is_suspended ? <Badge tone="danger">suspended</Badge> : null}
              {u.email ? <span className="text-sm text-muted">{u.email}</span> : null}<span className="text-xs text-muted">joined {formatDate(u.created_at)}</span>
            </div>
            {u.is_suspended && u.suspended_reason ? <p className="mt-1 text-sm text-danger">Reason: {u.suspended_reason}</p> : null}
            {u.id === staff.id ? <p className="mt-2 text-sm text-muted">This is you.</p> : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {u.is_suspended
                  ? <NoteActionForm action={suspendUserAction} fields={{ userId: u.id, suspended: "false" }} button="Reinstate" />
                  : <NoteActionForm action={suspendUserAction} fields={{ userId: u.id, suspended: "true" }} button="Suspend" variant="danger" noteLabel="Reason (required, shown to the member)" noteName="reason" required />}
                {admin ? (
                  <div className="space-y-2">
                    {["user", "moderator", "admin"].filter((r) => r !== u.role).map((r) => <NoteActionForm key={r} action={setUserRoleAction} fields={{ userId: u.id, role: r }} button={`Make ${r}`} variant="ghost" />)}
                  </div>
                ) : null}
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 ? <li className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">No accounts match.</li> : null}
      </ul>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / ADMIN_PAGE))} hrefFor={href} />
    </div>
  );
}
