import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireStaff } from "@/lib/auth/session";
import { isServiceRoleConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminHome() {
  const staff = await requireStaff();
  if (!isServiceRoleConfigured()) {
    return <Alert tone="warning" title="Service role key missing">Set SUPABASE_SERVICE_ROLE_KEY to load platform counts. See the README.</Alert>;
  }
  // Authorization was enforced above (and in the layout); the service role is only used for read-only counts.
  const admin = createAdminClient();
  const [users, startups, openReports] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("startups").select("*", { count: "exact", head: true }),
    admin.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const stats: [string, number | null][] = [
    ["Accounts", users.error ? null : (users.count ?? 0)],
    ["Startups", startups.error ? null : (startups.count ?? 0)],
    ["Open reports", openReports.error ? null : (openReports.count ?? 0)],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <Badge tone="green">{staff.role}</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardHeader><h2 className="text-sm font-medium text-muted">{label}</h2></CardHeader>
            <CardBody><p className="text-3xl font-bold tabular-nums">{value ?? "—"}</p></CardBody>
          </Card>
        ))}
      </div>
      <nav aria-label="Admin sections"><ul className="flex flex-wrap gap-3"><li><Link href="/admin/launches" className="font-medium">Launch moderation</Link></li><li><Link href="/admin/opportunities" className="font-medium">Opportunities</Link></li><li><Link href="/admin/investors" className="font-medium">Investors</Link></li><li><Link href="/admin/messages" className="font-medium">Contact inbox</Link></li></ul></nav>
      <p className="text-sm text-muted">Counts come straight from the database. Moderation queues, user management and the audit log are added in the final phase.</p>
    </div>
  );
}
