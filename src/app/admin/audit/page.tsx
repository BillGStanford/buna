import type { Metadata } from "next";
import { Pagination } from "@/components/startups/pagination";
import { buttonStyles } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { listAudit } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log (admin)" };
const ENTITIES = ["startup", "launch", "comment", "report", "user", "opportunity", "investor", "category", "setting"];

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const action = /^[a-z_.]{0,40}$/.test(sp.action ?? "") ? (sp.action ?? "") : "";
  const entity = ENTITIES.includes(sp.entity ?? "") ? sp.entity! : "";
  const parsed = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 1;
  const { rows, total } = await listAudit(action, entity, page);
  const href = (n: number) => `/admin/audit?${new URLSearchParams({ ...(action ? { action } : {}), ...(entity ? { entity } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Audit log</h1><p className="mt-1 text-sm text-muted">Append-only record of moderation and administration. Visible to admins only.</p></div>
      <form action="/admin/audit" method="get" role="search" aria-label="Filter the audit log" className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="au-a" className="mb-1 block text-sm font-medium">Action starts with</label><input id="au-a" name="action" defaultValue={action} placeholder="startup." className="h-10 rounded-md border border-line px-3 text-sm" /></div>
        <div><label htmlFor="au-e" className="mb-1 block text-sm font-medium">Item type</label><select id="au-e" name="entity" defaultValue={entity} className="h-10 rounded-md border border-line px-3 text-sm"><option value="">All</option>{ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
        <button type="submit" className={buttonStyles("secondary", "md")}>Filter</button>
      </form>
      <p className="text-sm text-muted"><span className="tabular-nums">{total}</span> entries</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Audit log</caption>
          <thead className="bg-primary-pale"><tr><th scope="col" className="p-3">When (UTC)</th><th scope="col" className="p-3">Who</th><th scope="col" className="p-3">Action</th><th scope="col" className="p-3">Item</th><th scope="col" className="p-3">Details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 align-top tabular-nums">{formatDateTime(r.created_at)}</td>
                <td className="p-3 align-top">{r.actor ? `@${r.actor.username}` : "system / deleted account"}</td>
                <td className="p-3 align-top font-medium">{r.action}</td>
                <td className="p-3 align-top"><span className="text-muted">{r.entity_type}</span>{r.entity_id ? <span className="block break-all text-xs">{r.entity_id}</span> : null}</td>
                <td className="p-3 align-top text-xs text-muted">{Object.keys(r.metadata).length ? JSON.stringify(r.metadata) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted">No entries.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / 50))} hrefFor={href} />
    </div>
  );
}
