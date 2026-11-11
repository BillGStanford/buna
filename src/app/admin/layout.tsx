import type { Metadata } from "next";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireStaff } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: { default: "Staff workspace", template: "%s · Buna Operations" }, robots: { index: false, follow: false } };

/** Staff-only operational workspace. Sensitive pages enforce their own admin-level checks. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const admin = isAdmin(staff.role);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-subtle/35">
      <div className="border-b border-line bg-surface">
        <div className="container-page flex min-h-[58px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">B</span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold tracking-tight text-ink">Buna Operations</p><p className="text-[11px] text-muted">Internal staff console</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline">Signed in as</span>
            <span className="rounded-full border border-line bg-surface-subtle px-2.5 py-1 text-[11px] font-semibold capitalize text-ink">{staff.role}</span>
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:min-h-[calc(100vh-7.7rem)] lg:flex-row">
        <AdminNavigation isAdmin={admin}/>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-9">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
